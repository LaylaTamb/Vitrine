import Link from "next/link"
import type { ReactNode } from "react"
import { Check } from "lucide-react"

import { BannerForm } from "@/components/layout/banner-form"
import { IdentityForm } from "@/components/layout/identity-form"
import { LetterboxdConnection } from "@/components/layout/letterboxd-connection"
import { ProfileCardForm } from "@/components/layout/profile-card-form"
import { SocialLinksForm } from "@/components/layout/social-links-form"
import { SteamConnection } from "@/components/layout/steam-connection"
import { buttonVariants } from "@/components/ui/button"
import {
  BANNER_DEFAULT_POSITION,
  cardCategoryOptions,
  clampBannerPosition,
  socialInputValue,
  SOCIAL_PROVIDERS,
} from "@/lib/domain/card"
import { timeAgo } from "@/lib/domain/social"
import type { Category, Folder, Profile } from "@/lib/domain/types"
import type { ConnectedAccountView, SteamAccountView } from "@/lib/queries/connected"

const LINK = "text-foreground underline underline-offset-2 transition-colors hover:text-brand"

/**
 * Meu perfil → Editar cartão (`/v/<@>?editar=1`): tudo o que aparece no
 * cartão, no próprio perfil — o banner, foto e nome, bio e destaques, as
 * redes, a Steam e o Letterboxd. O @, a senha e o resto da conta ficam nas Configurações.
 */
export function ProfileEditPanel({
  profile,
  categories,
  folders,
  counts,
  closeHref,
  steam,
  letterboxd,
}: {
  profile: Profile
  categories: Category[]
  folders: Folder[]
  counts: Record<string, number>
  /** O perfil sem o modo de edição. */
  closeHref: string
  steam: {
    ready: boolean
    configured: boolean
    account: SteamAccountView | null
    notice: { text: string; good: boolean } | null
  }
  letterboxd: {
    ready: boolean
    configured: boolean
    account: ConnectedAccountView | null
  }
}) {
  return (
    <section
      id="editar"
      aria-label="Editar cartão"
      className="mt-6 scroll-mt-20 space-y-8 rounded-2xl border border-line bg-surface p-4 sm:p-6"
    >
      <div className="space-y-1">
        <p className="plaque">Editar cartão</p>
        <h2 className="display text-2xl">O que aparece no seu perfil</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Todo mundo vê o cartão, mesmo sem conta. O @, a senha e o resto da conta ficam nas{" "}
          <Link href="/configuracoes" className={LINK}>
            Configurações
          </Link>
          .
        </p>
      </div>

      <Block
        id="banner"
        title="Banner"
        description="A faixa no topo do cartão, como no Twitter. Também vai para o story."
      >
        <BannerForm
          initialUrl={profile.banner_url ?? ""}
          initialPosition={
            profile.banner_position === undefined
              ? BANNER_DEFAULT_POSITION
              : clampBannerPosition(profile.banner_position)
          }
        />
      </Block>

      <Block title="Foto e nome">
        <IdentityForm
          username={profile.username}
          initialName={profile.display_name ?? ""}
          initialAvatarUrl={profile.avatar_url ?? ""}
        />
      </Block>

      <Block title="Bio e destaques">
        <ProfileCardForm
          ready={profile.card_category_ids !== undefined}
          initialBio={profile.bio ?? ""}
          initialIds={profile.card_category_ids ?? []}
          options={cardCategoryOptions(categories, folders).map((category) => ({
            id: category.id,
            name: category.name,
            icon: category.icon,
            total: counts[category.id] ?? 0,
          }))}
          names={Object.fromEntries(categories.map((category) => [category.id, category.name]))}
        />
      </Block>

      <Block title="Redes" description="Só o link: aparece no cartão.">
        <SocialLinksForm initialLinks={linkInputs(profile)} />
      </Block>

      <Block
        id="steam"
        title="Steam"
        description="Traz seus jogos de verdade, com as horas jogadas, para uma categoria sua."
      >
        <SteamConnection
          ready={steam.ready}
          configured={steam.configured}
          account={steam.account}
          syncedLabel={syncedLabel(steam.account?.lastSyncedAt ?? null)}
          notice={steam.notice}
        />
      </Block>

      <Block
        id="letterboxd"
        title="Letterboxd"
        description="Traz os filmes do seu diário, com nota e pôster, para uma categoria sua."
      >
        <LetterboxdConnection
          ready={letterboxd.ready}
          configured={letterboxd.configured}
          account={letterboxd.account}
          syncedLabel={syncedLabel(letterboxd.account?.lastSyncedAt ?? null, true)}
        />
      </Block>

      <div className="flex justify-end border-t border-line pt-5">
        <Link href={closeHref} className={buttonVariants()}>
          <Check className="size-4" /> Concluir
        </Link>
      </div>
    </section>
  )
}

function Block({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div id={id} className="max-w-[34rem] scroll-mt-20 space-y-4 border-t border-line pt-6">
      <div className="space-y-1">
        <h3 className="display text-xl">{title}</h3>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/**
 * "atualizada há 3 h" (a Steam) / "atualizado há 3 h" (o Letterboxd) —
 * calculado aqui, no servidor, para a hidratação bater.
 */
function syncedLabel(lastSyncedAt: string | null, masculine = false): string {
  if (!lastSyncedAt) return "ainda não sincronizou"
  const label = timeAgo(lastSyncedAt, new Date())
  const relative = label === "agora" || label.startsWith("há")
  const word = masculine ? "atualizado" : "atualizada"
  return relative ? `${word} ${label}` : `${word} em ${label}`
}

/** Os links gravados, do jeito que cada campo mostra ao abrir. */
function linkInputs(profile: Profile) {
  const stored = profile.social_links ?? {}
  return Object.fromEntries(
    SOCIAL_PROVIDERS.map((provider) => {
      const value = stored[provider]
      return [provider, typeof value === "string" ? socialInputValue(provider, value) : ""]
    })
  ) as Record<(typeof SOCIAL_PROVIDERS)[number], string>
}
