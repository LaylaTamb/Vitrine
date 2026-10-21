import type { Metadata } from "next"
import { UserX } from "lucide-react"
import { redirect } from "next/navigation"

import { CollectionsView } from "@/components/collection/collections-view"
import { AppShell, type VisitorInfo } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { ProfileCardView } from "@/components/social/profile-card"
import { ProfileEditPanel } from "@/components/social/profile-edit-panel"
import { ProfileSocialBar, VisitorFollowInvite } from "@/components/social/profile-social-bar"
import { QrRedeem } from "@/components/social/qr-redeem"
import type { ProfileCard } from "@/lib/domain/card"
import { itemCount, plural } from "@/lib/domain/format"
import { defaultVisibilityOf } from "@/lib/domain/privacy"
import { isQrToken } from "@/lib/domain/qr"
import { STEAM_RETURN_MESSAGES } from "@/lib/domain/steam"
import type { Profile } from "@/lib/domain/types"
import { normalizeUsername, profilePath, USERNAME_PATTERN } from "@/lib/domain/username"
import { getSteamAccount } from "@/lib/queries/connected"
import { getCollectionsByUsername } from "@/lib/queries/profiles"
import { getProfileCard, getPublicProfile, resolveUsername } from "@/lib/queries/public"
import { getProfileSocial } from "@/lib/queries/social"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"
import { steamConfigured } from "@/lib/steam/client"

type Params = Promise<{ username: string }>
type SearchParams = Promise<{
  qr?: string | string[]
  /** `?editar=1`: o painel de edição do cartão (só no seu perfil). */
  editar?: string | string[]
  /** O recado da volta do login da Steam. */
  steam?: string | string[]
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

/** Antes da migração 23 (sem cartão no banco): só o nome, o @ e a foto. */
function bareCard(profile: Profile): ProfileCard {
  return {
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
 * O SEU perfil é só o cartão (as suas coleções ficam em Coleções, `/`), e é
 * ali que ele se edita: `?editar=1` abre o painel com foto e nome, bio e
 * destaques, as redes e a Steam.
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

  const [{ profile, folders, categories, counts }, myProfile, card] = await Promise.all([
    getCollectionsByUsername(username),
    getMyProfile(),
    getProfileCard(username),
  ])

  if (!profile) return notFound(username, myProfile, undefined, qr)

  const isMe = profile.id === user.id
  // Precisa do id do perfil: é a segunda ida (contagens e relação, juntas).
  const social = await getProfileSocial(profile.id, user.id)
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
    const editing = query.editar === "1"
    const steam = editing ? await getSteamAccount(user.id) : null
    // "sem-chave" e "sem-banco" o próprio bloco da Steam já explica: sem recado em dobro.
    const steamStatus = typeof query.steam === "string" ? query.steam : ""
    const steamNotice = ["sem-chave", "sem-banco"].includes(steamStatus)
      ? null
      : (STEAM_RETURN_MESSAGES[steamStatus] ?? null)

    return (
      <AppShell profile={myProfile}>
        <div className="pt-6 pb-16">
          <QrRedeem token={qr} path={path} />
          <ProfileCardView
            card={card ?? bareCard(profile)}
            isMe
            ready={card !== null}
            editing={editing}
            social={socialBar}
          />
          {editing && steam ? (
            <ProfileEditPanel
              profile={myProfile}
              categories={categories}
              folders={folders}
              counts={counts}
              closeHref={path}
              steam={{
                ready: steam.ready,
                configured: steamConfigured(),
                account: steam.account,
                notice: steamNotice,
              }}
            />
          ) : null}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell profile={myProfile}>
      <CollectionsView
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
