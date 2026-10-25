import type { Metadata } from "next"
import { UserX } from "lucide-react"
import { redirect } from "next/navigation"

import { CollectionsView } from "@/components/collection/collections-view"
import { PublicNotice } from "@/components/collection/public-notice"
import { FavoritesView } from "@/components/favorites/favorites-view"
import { GlobalFilterView } from "@/components/filter/global-filter-view"
import { AppShell, type VisitorInfo } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { MapView } from "@/components/map/map-view"
import { HereBanner } from "@/components/nearby/here-banner"
import { ProfileCardView } from "@/components/social/profile-card"
import { ProfileSocialBar, VisitorFollowInvite } from "@/components/social/profile-social-bar"
import { profileTabOf, ProfileTabs } from "@/components/social/profile-tabs"
import { QrRedeem } from "@/components/social/qr-redeem"
import type { ProfileCard } from "@/lib/domain/card"
import { itemCount, plural } from "@/lib/domain/format"
import { placeTargets } from "@/lib/domain/nearby"
import { defaultVisibilityOf, needsPublicNotice } from "@/lib/domain/privacy"
import { isQrToken } from "@/lib/domain/qr"
import type { EntryView, Profile, Tag } from "@/lib/domain/types"
import { normalizeUsername, profilePath, USERNAME_PATTERN } from "@/lib/domain/username"
import { toView } from "@/lib/domain/view"
import { getAcervo } from "@/lib/queries/acervo"
import { getMyFavoriteIds } from "@/lib/queries/favorites"
import { getMyPlaces } from "@/lib/queries/places"
import { getCollectionsByUsername } from "@/lib/queries/profiles"
import { getProfileCard, getPublicProfile, resolveUsername } from "@/lib/queries/public"
import { getProfileSocial } from "@/lib/queries/social"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"
import { getMyTrashCount } from "@/lib/queries/trash"

type Params = Promise<{ username: string }>
type SearchParams = Promise<{
  qr?: string | string[]
  /** `?editar=1` (links antigos): vai para o Editar perfil, nas Configurações. */
  editar?: string | string[]
  /** O recado da volta do login da Steam (links antigos): segue junto. */
  steam?: string | string[]
  /** A aba do seu perfil: `favoritas` ou `mapa` (sem = Coleções). */
  aba?: string | string[]
  /** Na aba Mapa (vindos do antigo `/mapa`): a aba Sugestões, a categoria marcada, o item em foco. */
  mapa?: string | string[]
  categoria?: string | string[]
  item?: string | string[]
  /** `?filtros=1`: na aba Coleções, o antigo Filtro geral. */
  filtros?: string | string[]
}>

function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** O @ da URL do jeito que é guardado (`/v/@Layla` → `layla`). */
function usernameFrom(raw: string): string {
  return normalizeUsername(decoded(raw))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  return { title: `@${usernameFrom(username)} · Vitrine` }
}

function subtitleOf(categories: number, entries: number, empty: string): string {
  return categories === 0
    ? empty
    : `${plural(categories, "categoria", "categorias")} · ${itemCount(entries)}`
}

/** O acervo inteiro em cards (como no Filtro geral e no Mapa). */
function acervoViews(acervo: Awaited<ReturnType<typeof getAcervo>>): EntryView[] {
  const tagsById = new Map<string, Tag>(acervo.tags.map((tag) => [tag.id, tag]))
  return acervo.categories.flatMap((category) =>
    (acervo.entriesByCategory.get(category.id) ?? []).map((entry) =>
      toView(entry, category.estrutura, tagsById, category.name)
    )
  )
}

/** Antes da migração 23 (sem cartão no banco): só o nome, o @ e a foto. */
function bareCard(profile: Profile): ProfileCard {
  return {
    banner: null,
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    bio: null,
    links: [],
    categories: [],
  }
}

/**
 * `/v/[username]` — o perfil de alguém.
 *
 * Abre também SEM login: aí a leitura é pela função `public_profile` (só o
 * que é público) e a página convida a criar conta. Com login, a leitura é a
 * normal — a RLS decide o que aparece (Amigos inclusive).
 *
 * Um @ trocado há menos de 14 dias redireciona para o atual.
 *
 * `?qr=<código>` é o link do QR pessoal (migração 22): com login, quem abriu
 * vira amigo do dono (`QrRedeem`); sem login, vai entrar e volta para cá.
 *
 * O SEU perfil é o cartão e, embaixo, as abas Coleções (com o botão Filtros,
 * `?filtros=1`, o antigo Filtro geral), Favoritas (`?aba=favoritas`) e Mapa
 * (`?aba=mapa`). Cada aba carrega só os próprios dados. Editar o perfil é nas
 * Configurações (`?editar=1`, de links antigos, leva para lá).
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const [{ username: raw }, query] = await Promise.all([params, searchParams])
  const qr = isQrToken(query.qr) ? query.qr : null
  const username = usernameFrom(raw)
  const path = profilePath(username)
  // `/v/@Layla` e companhia: o endereço certo é um só. (Compara já decodificado:
  // um @ com acento continuaria diferente da URL e entraria em ciclo.)
  if (decoded(raw) !== username) redirect(withQr(path, qr))

  const user = await getSessionUser()
  const visitor: VisitorInfo | undefined = user ? undefined : { next: path }

  if (!user && qr) redirect(`/login?proximo=${encodeURIComponent(withQr(path, qr))}`)

  if (!user) {
    const data = USERNAME_PATTERN.test(username) ? await getPublicProfile(username) : null
    if (!data) return notFound(username, null, visitor, null)

    const { profile, card, folders, categories, counts } = data
    const total = Object.values(counts).reduce((acc, value) => acc + value, 0)
    return (
      <AppShell profile={null} visitor={visitor}>
        <CollectionsView
          folders={folders}
          categories={categories}
          counts={counts}
          canEdit={false}
          headerLabel="Coleções"
          headerTitle={`Coleções de ${profile.display_name || profile.username}`}
          headerSubtitle={subtitleOf(categories.length, total, "Nada público por aqui ainda.")}
          top={
            <ProfileCardView
              card={card ?? bareCard(profile)}
              isMe={false}
              ready={card !== null}
              social={<VisitorFollowInvite username={profile.username} />}
            />
          }
        />
      </AppShell>
    )
  }

  const [{ profile, folders, categories, counts, covers }, myProfile, card] = await Promise.all([
    getCollectionsByUsername(username),
    getMyProfile(),
    getProfileCard(username),
  ])

  if (!profile) return notFound(username, myProfile, undefined, qr)

  const isMe = profile.id === user.id
  // O link antigo de editar (e a volta antiga da Steam) leva às Configurações.
  if (isMe && query.editar === "1") {
    redirect(
      typeof query.steam === "string"
        ? `/configuracoes?secao=steam&steam=${encodeURIComponent(query.steam)}`
        : "/configuracoes?secao=perfil"
    )
  }
  const tab = profileTabOf(query.aba)
  const filtering = isMe && tab === "colecoes" && query.filtros === "1"
  const needAcervo = isMe && (tab === "mapa" || filtering)
  // Precisa do id do perfil: é a segunda ida — a relação e o que a aba aberta
  // pede, tudo junto.
  const [social, trashCount, favoriteIds, acervo, mapPlaces] = await Promise.all([
    getProfileSocial(profile.id, user.id),
    isMe ? getMyTrashCount() : undefined,
    isMe ? getMyFavoriteIds(user.id) : null,
    needAcervo ? getAcervo(user.id) : null,
    isMe && tab === "mapa" ? getMyPlaces(user.id) : null,
  ])
  const name = profile.display_name || profile.username
  const total = Object.values(counts).reduce((acc, value) => acc + value, 0)
  const socialBar = (
    // A chave muda com a relação: depois de virar amigo pelo QR (ou de
    // seguir), a faixa recomeça do que o banco diz agora.
    <ProfileSocialBar
      key={`${social.iFollow}-${social.followsMe}-${social.iBlocked}`}
      profileId={profile.id}
      username={profile.username}
      social={social}
      isMe={isMe}
    />
  )

  if (isMe && myProfile) {
    return (
      <AppShell profile={myProfile}>
        <div className="pt-6 pb-16">
          <QrRedeem token={qr} path={path} />
          {needsPublicNotice(myProfile, categories, folders) ? <PublicNotice /> : null}
          <ProfileCardView
            card={card ?? bareCard(profile)}
            isMe
            ready={card !== null}
            social={socialBar}
          />

          <ProfileTabs path={path} current={tab} />

          {tab === "mapa" && acervo && mapPlaces ? (
            <>
              {/* "Você está em X?": só aparece com a localização já autorizada. */}
              <HereBanner targets={placeTargets(acervo.categories)} />
              <MapView
                embedded
                categories={acervo.categories}
                views={acervoViews(acervo)}
                tags={acervo.tags}
                places={mapPlaces.places}
                placesReady={mapPlaces.ready}
                initialTab={query.mapa === "sugestoes" ? "sugestoes" : "mapa"}
                focusEntryId={typeof query.item === "string" ? query.item : null}
                initialCategoryId={typeof query.categoria === "string" ? query.categoria : null}
              />
            </>
          ) : tab === "favoritas" ? (
            <FavoritesView
              embedded
              ready={favoriteIds !== null}
              order={favoriteIds ?? []}
              categories={categories}
              folders={folders}
              counts={counts}
              covers={covers}
            />
          ) : filtering && acervo ? (
            <GlobalFilterView
              embedded
              closeHref={path}
              categories={acervo.categories}
              views={acervoViews(acervo)}
              tags={acervo.tags}
            />
          ) : (
            <CollectionsView
              embedded
              filtersHref={`${path}?filtros=1`}
              folders={folders}
              categories={categories}
              counts={counts}
              covers={covers}
              canEdit
              headerLabel="Coleções"
              headerTitle="Coleções"
              headerSubtitle={subtitleOf(categories.length, total, "Nada por aqui ainda.")}
              defaultVisibility={defaultVisibilityOf(myProfile)}
              searchable
              trashCount={trashCount}
              favoriteIds={favoriteIds ?? undefined}
            />
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell profile={myProfile}>
      <CollectionsView
        covers={covers}
        folders={folders}
        categories={categories}
        counts={counts}
        canEdit={false}
        defaultVisibility={defaultVisibilityOf(myProfile)}
        headerLabel="Coleções"
        headerTitle={`Coleções de ${name}`}
        headerSubtitle={subtitleOf(categories.length, total, "Nada por aqui ainda.")}
        top={
          <>
            <QrRedeem token={qr} path={path} />
            <ProfileCardView
              card={card ?? bareCard(profile)}
              isMe={false}
              ready={card !== null}
              social={socialBar}
            />
          </>
        }
      />
    </AppShell>
  )
}

/** O endereço do perfil, mantendo o código do QR quando há um. */
function withQr(path: string, qr: string | null): string {
  return qr ? `${path}?qr=${qr}` : path
}

/** Ninguém com esse @ — a não ser que seja um @ antigo: aí vai para o atual. */
async function notFound(
  username: string,
  myProfile: Profile | null,
  visitor: VisitorInfo | undefined,
  qr: string | null
) {
  const current = USERNAME_PATTERN.test(username) ? await resolveUsername(username) : null
  if (current && current !== username) redirect(withQr(profilePath(current), qr))

  return (
    <AppShell profile={myProfile} visitor={visitor}>
      <div className="py-16">
        <EmptyState
          icon={UserX}
          title="Perfil não encontrado"
          description={`Ninguém por aqui atende por @${username}.`}
        />
      </div>
    </AppShell>
  )
}
