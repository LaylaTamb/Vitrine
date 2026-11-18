import { ProfileEditor } from "@/components/social/profile-editor"
import {
  BANNER_DEFAULT_POSITION,
  cardCategoryOptions,
  clampBannerPosition,
  socialInputValue,
  SOCIAL_PROVIDERS,
} from "@/lib/domain/card"
import type { ProfileDraft } from "@/lib/domain/profile-edit"
import type { Category, Folder, Profile } from "@/lib/domain/types"

/**
 * Editar perfil (`/configuracoes?secao=perfil`; o botão do perfil traz para
 * cá): tudo o que aparece no cartão — o banner, foto e nome, bio, destaques e
 * as redes —, numa tela só e com um Salvar só (`ProfileEditor`). Aqui só se
 * monta o que está gravado. Steam e Letterboxd ficam em Apps e importação.
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
  /** O perfil, para o "Ver perfil" depois de salvar. */
  closeHref: string
}) {
  const names = Object.fromEntries(categories.map((category) => [category.id, category.name]))
  const stored = profile.social_links ?? {}
  const initial: ProfileDraft = {
    bannerUrl: profile.banner_url ?? "",
    bannerPosition:
      profile.banner_position === undefined
        ? BANNER_DEFAULT_POSITION
        : clampBannerPosition(profile.banner_position),
    avatarUrl: profile.avatar_url ?? "",
    displayName: profile.display_name ?? "",
    bio: profile.bio ?? "",
    // Categoria que já não existe some da lista (o servidor também a tira ao salvar).
    categoryIds: (profile.card_category_ids ?? []).filter((id) => id in names),
    links: Object.fromEntries(
      SOCIAL_PROVIDERS.map((provider) => {
        const value = stored[provider]
        return [provider, typeof value === "string" ? socialInputValue(provider, value) : ""]
      })
    ) as ProfileDraft["links"],
  }

  return (
    <ProfileEditor
      username={profile.username}
      initial={initial}
      cardReady={profile.card_category_ids !== undefined}
      options={cardCategoryOptions(categories, folders).map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        total: counts[category.id] ?? 0,
      }))}
      names={names}
      profileHref={closeHref}
    />
  )
}
