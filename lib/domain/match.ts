/**
 * Match (migração 30): juntar até 8 amigos para comparar as coleções. Quem
 * cria chama até 7 amigos; TODOS precisam aceitar — uma recusa cancela. Pronto
 * o match, todos veem a mesma lista (`blend.ts`, migração 45). Aqui fica a
 * leitura do que o banco devolve e as frases da tela; as regras moram nas
 * funções do banco.
 */

import { parseEstrutura } from "./fields"
import type { FieldDef, FieldValue } from "./types"

/** A cor de cada pessoa, pela ordem de entrada (mudou aqui, mude `match_color` no SQL 30). */
export const MATCH_COLORS = [
  "#B98CC2",
  "#8FB3C9",
  "#8FC9A6",
  "#D6C08A",
  "#C97B7B",
  "#C79BD0",
  "#B08A6A",
  "#9A9AA4",
] as const

/** Quantos amigos dá para chamar (8 pessoas com quem cria). */
export const MAX_MATCH_INVITES = 7

/** O erro de usar o Match antes de a migração 30 rodar. */
export const MATCHES_NOT_READY =
  "O Match ainda não está no banco: rode supabase/30_matches.sql no SQL Editor do Supabase."

export type MatchStatus = "pending" | "ready" | "canceled"
export type MemberStatus = "invited" | "accepted" | "declined"

export interface MatchMember {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  status: MemberStatus
  color: string
  position: number
}

export interface MatchView {
  id: string
  status: MatchStatus
  createdAt: string
  createdBy: string
  /** Na ordem de entrada (quem criou primeiro). */
  members: MatchMember[]
}

const MATCH_STATUSES: MatchStatus[] = ["pending", "ready", "canceled"]
const MEMBER_STATUSES: MemberStatus[] = ["invited", "accepted", "declined"]

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** As linhas de `matches` (com `match_members` e os perfis) → a tela. */
export function parseMatches(raw: unknown): MatchView[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): MatchView[] => {
    const row = item as Record<string, unknown> | null
    const id = text(row?.id)
    const createdBy = text(row?.created_by)
    const status = MATCH_STATUSES.find((value) => value === row?.status)
    if (!id || !createdBy || !status) return []
    const members = (Array.isArray(row?.match_members) ? row.match_members : [])
      .flatMap((value): MatchMember[] => {
        const member = value as Record<string, unknown> | null
        const profile = member?.profile as Record<string, unknown> | null | undefined
        const userId = text(member?.user_id)
        const username = text(profile?.username)
        const memberStatus = MEMBER_STATUSES.find((option) => option === member?.status)
        if (!userId || !username || !memberStatus) return []
        const color = text(member?.color)
        return [
          {
            userId,
            username,
            displayName: text(profile?.display_name),
            avatarUrl: text(profile?.avatar_url),
            status: memberStatus,
            color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : MATCH_COLORS[0],
            position: typeof member?.position === "number" ? member.position : 0,
          },
        ]
      })
      .sort((a, b) => a.position - b.position)
    return [{ id, status, createdAt: text(row?.created_at) ?? "", createdBy, members }]
  })
}

/** "@ana e você", "@ana, @bruno e você" — os outros primeiro, você no fim. */
export function matchPeopleLabel(match: Pick<MatchView, "members">, meId: string): string {
  const others = match.members.filter((member) => member.userId !== meId).map((m) => `@${m.username}`)
  if (others.length === 0) return "só você"
  return `${others.join(", ")} e você`
}

/** Do ponto de vista de quem vê: o que falta acontecer. */
export type MatchState = "answer" | "waiting" | "ready" | "canceled"

export function matchState(match: MatchView, meId: string): MatchState {
  if (match.status === "ready") return "ready"
  if (match.status === "canceled") return "canceled"
  const me = match.members.find((member) => member.userId === meId)
  return me?.status === "invited" ? "answer" : "waiting"
}

/** Quem ainda não respondeu. */
export function waitingFor(match: MatchView): MatchMember[] {
  return match.members.filter((member) => member.status === "invited")
}

/** Quem recusou (e cancelou o match). */
export function declinedBy(match: MatchView): MatchMember | null {
  return match.members.find((member) => member.status === "declined") ?? null
}

/** A frase do estado, para o cartão do match. */
export function matchStatusText(match: MatchView, meId: string): string {
  switch (matchState(match, meId)) {
    case "answer":
      return "Convite para você: aceite para comparar as coleções."
    case "waiting": {
      const waiting = waitingFor(match).map((member) => `@${member.username}`)
      return waiting.length === 1
        ? `Esperando ${waiting[0]} aceitar.`
        : `Esperando ${waiting.join(", ")} aceitarem.`
    }
    case "ready":
      return "Todo mundo aceitou: o match está pronto."
    case "canceled": {
      const declined = declinedBy(match)
      if (!declined) return "Cancelado."
      return declined.userId === meId
        ? "Você recusou, e o match foi cancelado."
        : `@${declined.username} recusou, e o match foi cancelado.`
    }
  }
}

// ---------------------------------------------------------------------------
// O "Trazer" e as cópias antigas
// ---------------------------------------------------------------------------

/** Os campos de um item original, já formatados — de onde o "Trazer" tira a Localização. */
export interface MatchOrigin {
  category: string | null
  /** `id` e `tipo` do campo original: a Localização ganha os links de mapa. */
  fields: { id: string; label: string; value: string; tipo: FieldDef["tipo"] }[]
}

/** A estrutura + os valores de um item (`{ estrutura, values }`) já formatados. */
export function matchOrigin(
  raw: unknown,
  format: (field: FieldDef, value: FieldValue) => string
): MatchOrigin {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const values = (data.values && typeof data.values === "object" ? data.values : {}) as Record<
    string,
    unknown
  >
  const fields = parseEstrutura(data.estrutura).flatMap((field) => {
    const value = values[field.id]
    if (value === null || value === undefined || value === "") return []
    const shown = format(field, value as FieldValue)
    return shown ? [{ id: field.id, label: field.nome, value: shown, tipo: field.tipo }] : []
  })
  return { category: typeof data.category === "string" ? data.category : null, fields }
}

/** A primeira Localização preenchida do original — o que o "Trazer" leva. */
export function matchLocation(origin: MatchOrigin): { fieldId: string; address: string } | null {
  const field = origin.fields.find((item) => item.tipo === "location")
  return field ? { fieldId: field.id, address: field.value.slice(0, 300) } : null
}

/** Uma cópia antiga de match (migração 31)? Ela só redireciona para a lista do match. */
export function isMatchCategory(category: { kind?: string | null } | null | undefined): boolean {
  return category?.kind === "match"
}
