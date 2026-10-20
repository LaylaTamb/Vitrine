/**
 * Cartão de apresentação do perfil (migração 23): bio, links das redes e até
 * 5 categorias públicas com os 3 melhores itens. Quem monta o cartão é o
 * banco (`profile_card`); aqui ficam as regras do formulário e a leitura
 * cuidadosa do que volta (um link estranho gravado direto pela API nunca vira
 * `href`).
 */

import { isInbox } from "./inbox"
import { effectiveVisibility, visibilityOf } from "./privacy"
import type { Category, Folder } from "./types"

export const BIO_MAX = 220
export const CARD_MAX_CATEGORIES = 5

/** O erro de gravar o cartão antes de a migração 23 rodar. */
export const CARD_NOT_READY =
  "O cartão ainda não está no banco: rode supabase/23_profile_card.sql no SQL Editor do Supabase (antes dele, do 14 ao 22)."

// ---------------------------------------------------------------------------
// Links das redes
// ---------------------------------------------------------------------------

export const SOCIAL_PROVIDERS = ["instagram", "x", "discord", "spotify", "youtube"] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export const SOCIAL_LABELS: Record<SocialProvider, string> = {
  instagram: "Instagram",
  x: "X",
  discord: "Discord",
  spotify: "Spotify",
  youtube: "YouTube",
}

export const SOCIAL_PLACEHOLDERS: Record<SocialProvider, string> = {
  instagram: "@seunome ou link do perfil",
  x: "@seunome ou link do perfil",
  discord: "seunome ou link de convite",
  spotify: "link do perfil, artista ou playlist",
  youtube: "@seucanal ou link do canal",
}

const SOCIAL_PROBLEMS: Record<SocialProvider, string> = {
  instagram: "Use o @ ou o link de um perfil do Instagram.",
  x: "Use o @ (até 15 letras, números ou _) ou o link de um perfil do X.",
  discord: "Use o seu nome de usuário do Discord ou um link de convite (discord.gg/…).",
  spotify: "Cole o link de um perfil, artista, playlist ou podcast do open.spotify.com.",
  youtube: "Use o @ do canal ou o link dele no YouTube.",
}

/** O que fica gravado: o @ (sem a arroba) ou um link já no formato certo. */
export type SocialLinks = Partial<Record<SocialProvider, string>>

export interface SocialLink {
  provider: SocialProvider
  /** Como aparece: "@ana", "playlist", "discord.gg/abc". */
  label: string
  /** Para onde leva. `null` = sem página pública (nome do Discord: só copiar). */
  href: string | null
}

type Normalized = { ok: true; value: string | null } | { ok: false; error: string }

/** O texto como URL, se ele parecer uma (com ou sem `https://`). */
function asUrl(raw: string, hosts: string[]): URL | null {
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  return hosts.includes(url.hostname.toLowerCase()) ? url : null
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean)
}

function looksLikeUrl(raw: string): boolean {
  return raw.includes("/") || /\.(com|gg|be)\b/i.test(raw)
}

const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/
const X_HANDLE = /^[a-z0-9_]{1,15}$/
const DISCORD_HANDLE = /^[a-z0-9_.]{2,32}$/
const DISCORD_INVITE = /^[A-Za-z0-9-]{2,32}$/
const SPOTIFY_ID = /^[A-Za-z0-9._-]{1,64}$/
const SPOTIFY_KINDS = ["user", "artist", "playlist", "show"] as const
const YOUTUBE_HANDLE = /^[A-Za-z0-9._-]{3,30}$/
const YOUTUBE_ID = /^[A-Za-z0-9_-]{2,64}$/

function normalizeInstagram(raw: string): string | null {
  let handle = raw
  if (looksLikeUrl(raw)) {
    const url = asUrl(raw, ["instagram.com", "www.instagram.com", "m.instagram.com"])
    if (!url) return null
    handle = segments(url)[0] ?? ""
  }
  handle = handle.replace(/^@/, "").toLowerCase()
  return INSTAGRAM_HANDLE.test(handle) ? handle : null
}

function normalizeX(raw: string): string | null {
  let handle = raw
  if (looksLikeUrl(raw)) {
    const url = asUrl(raw, [
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com",
      "mobile.twitter.com",
      "mobile.x.com",
    ])
    if (!url) return null
    handle = segments(url)[0] ?? ""
  }
  handle = handle.replace(/^@/, "").toLowerCase()
  return X_HANDLE.test(handle) ? handle : null
}

function normalizeDiscord(raw: string): string | null {
  if (looksLikeUrl(raw)) {
    const url = asUrl(raw, ["discord.gg", "www.discord.gg", "discord.com", "www.discord.com"])
    if (!url) return null
    const parts = segments(url)
    const code = url.hostname.endsWith("discord.gg")
      ? parts[0]
      : parts[0] === "invite"
        ? parts[1]
        : undefined
    return code && DISCORD_INVITE.test(code) ? `https://discord.gg/${code}` : null
  }
  const handle = raw.replace(/^@/, "").toLowerCase()
  return DISCORD_HANDLE.test(handle) ? handle : null
}

function normalizeSpotify(raw: string): string | null {
  const uri = /^spotify:(user|artist|playlist|show):([A-Za-z0-9._-]+)$/.exec(raw)
  let kind: string | undefined
  let id: string | undefined
  if (uri) {
    kind = uri[1]
    id = uri[2]
  } else {
    const url = asUrl(raw, ["open.spotify.com"])
    if (!url) return null
    const parts = segments(url)
    // Links com idioma: /intl-pt/playlist/…
    const start = parts[0]?.startsWith("intl-") ? 1 : 0
    kind = parts[start]
    id = parts[start + 1]
  }
  if (!kind || !id || !(SPOTIFY_KINDS as readonly string[]).includes(kind)) return null
  return SPOTIFY_ID.test(id) ? `https://open.spotify.com/${kind}/${id}` : null
}

function normalizeYoutube(raw: string): string | null {
  if (!looksLikeUrl(raw)) {
    const handle = raw.replace(/^@/, "")
    return YOUTUBE_HANDLE.test(handle) ? `https://www.youtube.com/@${handle}` : null
  }
  const url = asUrl(raw, ["youtube.com", "www.youtube.com", "m.youtube.com"])
  if (!url) return null
  const [first, second] = segments(url)
  if (first?.startsWith("@")) {
    const handle = first.slice(1)
    return YOUTUBE_HANDLE.test(handle) ? `https://www.youtube.com/@${handle}` : null
  }
  if ((first === "channel" || first === "c" || first === "user") && second) {
    return YOUTUBE_ID.test(second) ? `https://www.youtube.com/${first}/${second}` : null
  }
  return null
}

const NORMALIZERS: Record<SocialProvider, (raw: string) => string | null> = {
  instagram: normalizeInstagram,
  x: normalizeX,
  discord: normalizeDiscord,
  spotify: normalizeSpotify,
  youtube: normalizeYoutube,
}

/**
 * O que a pessoa digitou → o que fica gravado. Vazio apaga o link. Aceita o @
 * ou o link (com ou sem `https://`); a mesma função relê o que já está
 * gravado, então aplicar duas vezes não muda nada.
 */
export function normalizeSocialLink(provider: SocialProvider, raw: string): Normalized {
  const text = raw.trim()
  if (!text) return { ok: true, value: null }
  const value = NORMALIZERS[provider](text)
  return value ? { ok: true, value } : { ok: false, error: SOCIAL_PROBLEMS[provider] }
}

const SPOTIFY_KIND_LABELS: Record<string, string> = {
  user: "perfil",
  artist: "artista",
  playlist: "playlist",
  show: "podcast",
}

function describe(provider: SocialProvider, value: string): SocialLink {
  switch (provider) {
    case "instagram":
      return { provider, label: `@${value}`, href: `https://www.instagram.com/${value}/` }
    case "x":
      return { provider, label: `@${value}`, href: `https://x.com/${value}` }
    case "discord":
      return value.startsWith("https://")
        ? { provider, label: value.replace("https://", ""), href: value }
        : { provider, label: value, href: null }
    case "spotify": {
      const kind = value.split("/")[3] ?? ""
      return { provider, label: SPOTIFY_KIND_LABELS[kind] ?? "perfil", href: value }
    }
    case "youtube": {
      const path = value.replace("https://www.youtube.com/", "")
      return { provider, label: path.startsWith("@") ? path : "canal", href: value }
    }
  }
}

/**
 * Os links gravados, prontos para mostrar, na ordem fixa das redes. Tudo
 * passa de novo pela normalização: o que não fecha é descartado.
 */
export function socialLinksFrom(raw: unknown): SocialLink[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  const stored = raw as Record<string, unknown>
  return SOCIAL_PROVIDERS.flatMap((provider) => {
    const value = stored[provider]
    if (typeof value !== "string") return []
    const normalized = normalizeSocialLink(provider, value)
    return normalized.ok && normalized.value ? [describe(provider, normalized.value)] : []
  })
}

/** O que cada campo do formulário mostra ao abrir: o @ com arroba, ou o link. */
export function socialInputValue(provider: SocialProvider, stored: string | undefined): string {
  if (!stored) return ""
  if (stored.startsWith("https://")) return stored
  return provider === "discord" ? stored : `@${stored}`
}

// ---------------------------------------------------------------------------
// Categorias do cartão
// ---------------------------------------------------------------------------

type FolderLike = Pick<Folder, "id" | "name" | "parent_folder_id"> & {
  visibility?: Folder["visibility"]
  is_public?: boolean
}

/**
 * As categorias que podem ir para o cartão: públicas de fato (nenhuma pasta
 * acima fechando) e fora a "A organizar".
 */
export function cardCategoryOptions<
  T extends Pick<Category, "id" | "folder_id" | "kind" | "visibility" | "is_public">,
>(categories: T[], folders: FolderLike[]): T[] {
  return categories.filter(
    (category) =>
      !isInbox(category) &&
      effectiveVisibility(visibilityOf(category), folders, category.folder_id) === "public"
  )
}

/** Os ids escolhidos, sem repetir e no máximo 5 — a ordem é a do cartão. */
export function cleanCardIds(ids: string[]): string[] {
  return [...new Set(ids)].slice(0, CARD_MAX_CATEGORIES)
}

/** Sobe (`-1`) ou desce (`+1`) uma posição. Fora dos limites, nada muda. */
export function moveCardId(ids: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// ---------------------------------------------------------------------------
// O cartão lido do banco
// ---------------------------------------------------------------------------

export interface CardItem {
  id: string
  name: string
  rating: number | null
  image_url: string | null
}

export interface CardCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  rating_enabled: boolean
  total: number
  top: CardItem[]
}

export interface ProfileCard {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  bio: string | null
  links: SocialLink[]
  categories: CardCategory[]
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function cardItem(raw: unknown): CardItem[] {
  if (!raw || typeof raw !== "object") return []
  const row = raw as Record<string, unknown>
  const id = text(row.id)
  const name = text(row.name)
  if (!id || !name) return []
  return [
    {
      id,
      name,
      rating: typeof row.rating === "number" ? row.rating : null,
      image_url: text(row.image_url),
    },
  ]
}

function cardCategory(raw: unknown): CardCategory[] {
  if (!raw || typeof raw !== "object") return []
  const row = raw as Record<string, unknown>
  const id = text(row.id)
  const name = text(row.name)
  if (!id || !name) return []
  return [
    {
      id,
      name,
      icon: text(row.icon),
      color: text(row.color),
      rating_enabled: row.rating_enabled !== false,
      total: typeof row.total === "number" ? row.total : 0,
      top: (Array.isArray(row.top) ? row.top : []).flatMap(cardItem).slice(0, 3),
    },
  ]
}

/** O que `profile_card` devolve, conferido campo a campo. `null` = sem cartão. */
export function parseProfileCard(raw: unknown): ProfileCard | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const profile = row.profile as Record<string, unknown> | undefined
  const id = text(profile?.id)
  const username = text(profile?.username)
  if (!id || !username) return null
  const bio = text(row.bio)
  return {
    profile: {
      id,
      username,
      display_name: text(profile?.display_name),
      avatar_url: text(profile?.avatar_url),
    },
    bio: bio ? bio.slice(0, BIO_MAX) : null,
    links: socialLinksFrom(row.social_links),
    categories: (Array.isArray(row.categories) ? row.categories : [])
      .flatMap(cardCategory)
      .slice(0, CARD_MAX_CATEGORIES),
  }
}

/** O cartão tem algo além do nome e do @? (Sem nada, a tela nem mostra a caixa.) */
export function cardHasContent(card: ProfileCard | null): boolean {
  return Boolean(card && (card.bio || card.links.length > 0 || card.categories.length > 0))
}
