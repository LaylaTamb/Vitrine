/**
 * Editar perfil com um Salvar só: o rascunho da tela inteira, o que mudou
 * em relação ao que está gravado e a conta do arrasto do banner.
 */

import { SOCIAL_PROVIDERS, type SocialProvider } from "./card"

export interface ProfileDraft {
  bannerUrl: string
  /** 0 = topo da imagem, 100 = pé. */
  bannerPosition: number
  avatarUrl: string
  displayName: string
  bio: string
  categoryIds: string[]
  links: Record<SocialProvider, string>
}

/** As partes da tela; bio e destaques gravam juntas (o cartão), mas aparecem separadas. */
export type ProfilePart = "banner" | "identity" | "bio" | "highlights" | "social"

export const PROFILE_PART_LABELS: Record<ProfilePart, string> = {
  banner: "Banner",
  identity: "Foto e nome",
  bio: "Bio",
  highlights: "Destaques",
  social: "Redes",
}

/** O que mudou do gravado para o rascunho, na ordem da tela. */
export function changedProfileParts(saved: ProfileDraft, draft: ProfileDraft): ProfilePart[] {
  const parts: ProfilePart[] = []
  if (
    saved.bannerUrl.trim() !== draft.bannerUrl.trim() ||
    (draft.bannerUrl.trim() !== "" && saved.bannerPosition !== draft.bannerPosition)
  ) {
    parts.push("banner")
  }
  if (
    saved.avatarUrl.trim() !== draft.avatarUrl.trim() ||
    saved.displayName.trim() !== draft.displayName.trim()
  ) {
    parts.push("identity")
  }
  if (saved.bio !== draft.bio) parts.push("bio")
  if (saved.categoryIds.join() !== draft.categoryIds.join()) parts.push("highlights")
  if (
    SOCIAL_PROVIDERS.some(
      (provider) => saved.links[provider].trim() !== draft.links[provider].trim()
    )
  ) {
    parts.push("social")
  }
  return parts
}

/**
 * Arrastar o banner: a imagem acompanha o dedo. `overflow` é quanto a imagem
 * sobra na altura com `cover` (em px); sem sobra, a posição não muda nada.
 */
export function bannerPositionAfterDrag(position: number, dy: number, overflow: number): number {
  if (!(overflow > 0)) return position
  return Math.min(100, Math.max(0, position - (dy / overflow) * 100))
}
