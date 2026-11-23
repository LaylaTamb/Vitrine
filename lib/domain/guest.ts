/**
 * Modo visitante (migração 50): quem não tem conta explora só o que é
 * Público, pelas funções `explore_public_categories`, `public_category_covers`,
 * `public_people` e `public_follows`. Aqui ficam as leituras das respostas
 * delas e o aviso de quando o 50 ainda não rodou.
 */

import type { Profile } from "./types"

/** Uma pessoa com alguma lista Pública. `lists`: quantas categorias Públicas ela tem. */
export interface PublicPerson extends Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url"
> {
  lists: number
}

export interface PublicFollows {
  followers: number
  following: number
  /** O perfil não tem nada Público: só as contagens, sem a lista. */
  hidden: boolean
  people: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">[]
}

/** O que aparece no lugar das Sugestões, sem conta, enquanto o 50 não rodou. */
export const GUEST_NOT_READY =
  "Explorar sem conta ainda não está ligado: rode supabase/50_guest_mode.sql no SQL Editor do Supabase."

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null

function person(
  raw: unknown
): Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null {
  const row = raw as Record<string, unknown> | null
  const id = text(row?.id)
  const username = text(row?.username)
  if (!id || !username) return null
  return {
    id,
    username,
    display_name: text(row?.display_name),
    avatar_url: text(row?.avatar_url),
  }
}

/** A resposta do `public_people`; o que vier estranho fica de fora. */
export function parsePublicPeople(raw: unknown): PublicPerson[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    const base = person(row)
    if (!base) return []
    const lists = Number((row as Record<string, unknown>).lists)
    return [{ ...base, lists: Number.isFinite(lists) && lists > 0 ? Math.trunc(lists) : 0 }]
  })
}

/** A resposta do `public_follows`; `null` quando o @ não existe. */
export function parsePublicFollows(raw: unknown): PublicFollows | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const count = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
  }
  return {
    followers: count(row.followers),
    following: count(row.following),
    hidden: row.hidden === true,
    people: Array.isArray(row.people) ? row.people.flatMap((item) => person(item) ?? []) : [],
  }
}

/**
 * O Explorar recusa quem não tem conta antes do 50 (o 33 levanta "É preciso
 * entrar na conta", código 42501): é o mesmo que a função não existir.
 */
export function isGuestBlocked(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === "42501"
}

/** Por que a janela de convite abriu: a ação que pede conta. */
export type InviteReason =
  | { kind: "signup" }
  | { kind: "follow"; username: string }
  | { kind: "take"; name: string }
  | { kind: "add" }
  | { kind: "match" }
  | { kind: "map" }

/**
 * O texto da janela de convite, conforme a ação. A pessoa aparece pelo @
 * (não pelo nome): assim a frase não precisa adivinhar "a Ana" ou "o Bruno".
 */
export function inviteCopy(reason: InviteReason): { icon: string; title: string; text: string } {
  switch (reason.kind) {
    case "follow":
      return {
        icon: "👤",
        title: `Crie sua conta para seguir @${reason.username}`,
        text: "Você vê as novidades de quem segue na aba Amigos do Início.",
      }
    case "take":
      return {
        icon: "📥",
        title: `Crie sua conta para pegar “${reason.name}”`,
        text: "A cópia fica com você e continua recebendo as novidades de quem fez.",
      }
    case "add":
      return {
        icon: "✨",
        title: "Crie sua conta para adicionar o que você ama",
        text: "Itens, categorias, pastas e o que já está no Google Maps, no Letterboxd ou na Steam.",
      }
    case "match":
      return {
        icon: "💞",
        title: "Crie sua conta para fazer um match",
        text: "Siga seus amigos e descubra o que vocês têm em comum.",
      }
    case "map":
      return {
        icon: "📍",
        title: "Crie sua conta para montar o seu mapa",
        text: "Os lugares das suas listas aparecem no mapa, com o que está perto de você.",
      }
    case "signup":
      return {
        icon: "✨",
        title: "Crie sua conta",
        text: "É grátis e leva um minuto. Depois você volta direto para cá.",
      }
  }
}
