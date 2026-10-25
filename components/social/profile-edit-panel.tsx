import Link from "next/link"
import type { ReactNode } from "react"
import { Check } from "lucide-react"

import { BannerForm } from "@/components/layout/banner-form"
import { IdentityForm } from "@/components/layout/identity-form"
import { ProfileCardForm } from "@/components/layout/profile-card-form"
import { SocialLinksForm } from "@/components/layout/social-links-form"
import { buttonVariants } from "@/components/ui/button"
import {
  BANNER_DEFAULT_POSITION,
  cardCategoryOptions,
  clampBannerPosition,
  socialInputValue,
  SOCIAL_PROVIDERS,
} from "@/lib/domain/card"
import type { Category, Folder, Profile } from "@/lib/domain/types"

/**
 * Editar perfil (`/configuracoes?secao=perfil`; o botão do perfil traz para
 * cá): tudo o que aparece no cartão — o banner, foto e nome, bio e destaques e
 * as redes. Steam e Letterboxd ficam em Apps e importação, nas Configurações.
 */
export function ProfileEditPanel({
  profile,
  categories,
  folders,
  counts,
  closeHref,
}: {
  profile: Profile
  categories: Category[]
  folders: Folder[]
  counts: Record<string, number>
  /** O "Concluir": volta para o perfil. */
  closeHref: string
}) {
  return (
    <section aria-label="Editar perfil" className="space-y-8">
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
