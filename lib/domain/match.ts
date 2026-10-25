/**
 * Match (migração 30): juntar até 8 amigos para comparar as coleções. Quem
 * cria chama até 7 amigos; TODOS precisam aceitar — uma recusa cancela. Pronto
 * o match, cada pessoa ganha a sua cópia (Etapa 5.2). Aqui fica a leitura do
 * que o banco devolve e as frases da tela; as regras moram nas funções do
 * banco.
 */

import { parseEstrutura } from "./fields"
import type { EntryMatch, FieldDef, FieldValue } from "./types"

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
// A cópia de cada pessoa (Etapa 5.2, migração 31)
// ---------------------------------------------------------------------------

/**
 * Um item da cópia, para as contas: de quem é, a chave de "mesma coisa"
 * (`match_key`, montada pelo banco: o mesmo lugar do catálogo, ou o mesmo
 * título normalizado em categorias equivalentes) e a nota de quem é dono.
 */
export interface MatchItem {
  id: string
  ownerId: string
  key: string
  rating: number | null
}

export interface MatchMarks {
  /** Pelo menos 2 pessoas do match têm. */
  common: boolean
  /** Para quem é sugestão: nota ≥ 4 de quem tem, e a pessoa não tem. */
  suggestionFor: string[]
}

/** A nota mínima para virar sugestão para os outros. */
export const SUGGESTION_MIN_RATING = 4

/**
 * As marcações de cada item: "Em comum" (2+ pessoas têm a mesma coisa) e
 * "Sugestão para @x" (nota ≥ 4 de quem tem; @x não tem). Contadas só com o
 * que está na cópia — o que alguém não deixa ver não denuncia nada.
 */
export function matchMarks(items: MatchItem[], memberIds: string[]): Map<string, MatchMarks> {
  const ownersByKey = new Map<string, Set<string>>()
  for (const item of items) {
    const owners = ownersByKey.get(item.key) ?? new Set<string>()
    owners.add(item.ownerId)
    ownersByKey.set(item.key, owners)
  }
  const marks = new Map<string, MatchMarks>()
  for (const item of items) {
    const owners = ownersByKey.get(item.key) ?? new Set<string>()
    const suggestionFor =
      item.rating !== null && item.rating >= SUGGESTION_MIN_RATING
        ? memberIds.filter((member) => member !== item.ownerId && !owners.has(member))
        : []
    marks.set(item.id, { common: owners.size >= 2, suggestionFor })
  }
  return marks
}

/**
 * A fórmula da Parte 2 do plano, para um par:
 *   sobreposição = itens em comum ÷ (25% da coleção menor), no máximo 1;
 *   concordância = média de (1 − |nota A − nota B| ÷ 5) nos itens avaliados
 *                  pelos dois (1 se não houver);
 *   compatibilidade = sobreposição × (0,6 + 0,4 × concordância).
 * Devolve de 0 a 1.
 */
export function compatibility(input: {
  sizeA: number
  sizeB: number
  common: number
  agreement: number
}): number {
  const smaller = Math.min(input.sizeA, input.sizeB)
  if (smaller <= 0 || input.common <= 0) return 0
  const overlap = Math.min(1, input.common / Math.max(1, smaller * 0.25))
  const agreement = Math.min(1, Math.max(0, input.agreement))
  return overlap * (0.6 + 0.4 * agreement)
}

export interface PairCompat {
  a: string
  b: string
  /** 0 a 100. */
  percent: number
  common: number
}

/** A compatibilidade de um par, a partir dos itens da cópia de cada um. */
export function pairCompat(a: MatchItem[], b: MatchItem[]): Omit<PairCompat, "a" | "b"> {
  const ratingsOf = (items: MatchItem[]) => {
    const map = new Map<string, number | null>()
    for (const item of items) {
      const current = map.get(item.key)
      // Duas vezes a mesma coisa: vale a nota que existir (a maior).
      map.set(item.key, current == null ? item.rating : Math.max(current, item.rating ?? current))
    }
    return map
  }
  const ratingsA = ratingsOf(a)
  const ratingsB = ratingsOf(b)
  const commonKeys = [...ratingsA.keys()].filter((key) => ratingsB.has(key))
  const rated = commonKeys.flatMap((key) => {
    const ra = ratingsA.get(key)
    const rb = ratingsB.get(key)
    return ra != null && rb != null ? [1 - Math.abs(ra - rb) / 5] : []
  })
  const agreement = rated.length > 0 ? rated.reduce((sum, value) => sum + value, 0) / rated.length : 1
  const value = compatibility({
    sizeA: ratingsA.size,
    sizeB: ratingsB.size,
    common: commonKeys.length,
    agreement,
  })
  return { percent: Math.round(value * 100), common: commonKeys.length }
}

/** Todos os pares e o grupo (a média dos pares). Com 2 pessoas, o grupo é o par. */
export function groupCompat(
  items: MatchItem[],
  memberIds: string[]
): { group: number | null; pairs: PairCompat[] } {
  const byOwner = new Map<string, MatchItem[]>()
  for (const item of items) {
    byOwner.set(item.ownerId, [...(byOwner.get(item.ownerId) ?? []), item])
  }
  const pairs: PairCompat[] = []
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const a = memberIds[i]
      const b = memberIds[j]
      pairs.push({ a, b, ...pairCompat(byOwner.get(a) ?? [], byOwner.get(b) ?? []) })
    }
  }
  if (pairs.length === 0) return { group: null, pairs }
  const group = Math.round(pairs.reduce((sum, pair) => sum + pair.percent, 0) / pairs.length)
  return { group, pairs }
}

/** O que a tela de um item da cópia mostra do original (só leitura). */
export interface MatchOrigin {
  category: string | null
  /** `id` e `tipo` do campo original: a Localização ganha os links de mapa. */
  fields: { id: string; label: string; value: string; tipo: FieldDef["tipo"] }[]
}

/** O `match_fields` (estrutura + valores do original) já formatado. */
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

/** A cópia de um match (migração 31)? Ausente = comum. */
export function isMatchCategory(category: { kind?: string | null } | null | undefined): boolean {
  return category?.kind === "match"
}

/** O erro de abrir a cópia antes de a migração 31 rodar. */
export const MATCH_COPY_NOT_READY =
  "A cópia do match ainda não está no banco: rode supabase/31_match_build.sql no SQL Editor do Supabase."

/** Uma pessoa na legenda da cópia. */
export interface MatchCopyPerson {
  userId: string
  /** "você" ou "@ana". */
  label: string
  color: string
  isMe: boolean
  /** Quantos itens dela estão na cópia. */
  items: number
}

export interface MatchCopyPair extends PairCompat {
  /** "você e @ana", "@ana e @bruno". */
  label: string
  withMe: boolean
}

/** O painel da cópia: quem está, as porcentagens e os totais dos filtros rápidos. */
export interface MatchCopyInfo {
  matchId: string | null
  people: MatchCopyPerson[]
  /** A média dos pares (com 2 pessoas, é o par). */
  group: number | null
  /** Os pares com você primeiro. */
  pairs: MatchCopyPair[]
  /** `theirs`: os seus itens que são sugestão para alguém do match. */
  totals: { common: number; suggestions: number; theirs: number }
}

/** Uma linha da cópia, como vem do banco. */
export interface MatchCopyRow {
  id: string
  rating: number | string | null
  match_owner_id?: string | null
  match_key?: string | null
  match_color?: string | null
}

/**
 * Junta a cópia (as linhas) e o match (as pessoas) do ponto de vista de quem
 * abre: a legenda, as porcentagens e as marcações de cada item. O match pode
 * não vir (sumiu do banco): aí as pessoas saem dos próprios itens.
 */
export function decorateMatchCopy(input: {
  rows: MatchCopyRow[]
  match: MatchView | null
  meId: string
}): { info: MatchCopyInfo; byEntry: Map<string, EntryMatch> } {
  const { rows, match, meId } = input
  const people: MatchCopyPerson[] = (match?.members ?? []).map((member) => ({
    userId: member.userId,
    label: member.userId === meId ? "você" : `@${member.username}`,
    color: member.color,
    isMe: member.userId === meId,
    items: 0,
  }))
  for (const row of rows) {
    const ownerId = row.match_owner_id ?? ""
    if (!people.some((person) => person.userId === ownerId)) {
      people.push({
        userId: ownerId,
        label: ownerId === meId ? "você" : ownerId ? "alguém" : "conta excluída",
        color: row.match_color ?? MATCH_COLORS[MATCH_COLORS.length - 1],
        isMe: ownerId === meId,
        items: 0,
      })
    }
  }
  // Você primeiro na legenda; os outros na ordem do match.
  people.sort((a, b) => Number(b.isMe) - Number(a.isMe))
  const personOf = new Map(people.map((person) => [person.userId, person]))

  const items: MatchItem[] = rows.map((row) => {
    const rating = row.rating === null || row.rating === undefined ? null : Number(row.rating)
    return {
      id: row.id,
      ownerId: row.match_owner_id ?? "",
      key: row.match_key || `id:${row.id}`,
      rating: rating !== null && Number.isFinite(rating) && rating > 0 ? rating : null,
    }
  })
  for (const item of items) {
    const person = personOf.get(item.ownerId)
    if (person) person.items += 1
  }

  const memberIds = people.filter((person) => person.userId).map((person) => person.userId)
  const marks = matchMarks(items, memberIds)
  const { group, pairs } = groupCompat(items, memberIds)
  const labelOf = (id: string) => personOf.get(id)?.label ?? "alguém"

  const byEntry = new Map<string, EntryMatch>()
  let common = 0
  let suggestions = 0
  let theirs = 0
  for (const item of items) {
    const mark = marks.get(item.id) ?? { common: false, suggestionFor: [] }
    const person = personOf.get(item.ownerId)
    const suggestionForMe = mark.suggestionFor.includes(meId)
    if (mark.common) common += 1
    if (suggestionForMe) suggestions += 1
    if (item.ownerId === meId && mark.suggestionFor.length > 0) theirs += 1
    byEntry.set(item.id, {
      ownerId: item.ownerId,
      ownerLabel: person?.label ?? "alguém",
      isMine: item.ownerId === meId,
      color: person?.color ?? MATCH_COLORS[0],
      common: mark.common,
      suggestionForMe,
      suggestionFor: [...mark.suggestionFor]
        .sort((a, b) => Number(b === meId) - Number(a === meId))
        .map(labelOf),
    })
  }

  const copyPairs: MatchCopyPair[] = pairs
    .map((pair) => {
      const withMe = pair.a === meId || pair.b === meId
      const [first, second] = pair.b === meId ? [pair.b, pair.a] : [pair.a, pair.b]
      return { ...pair, withMe, label: `${labelOf(first)} e ${labelOf(second)}` }
    })
    .sort((a, b) => Number(b.withMe) - Number(a.withMe))

  return {
    info: {
      matchId: match?.id ?? null,
      people,
      group,
      pairs: copyPairs,
      totals: { common, suggestions, theirs },
    },
    byEntry,
  }
}

/**
 * Os filtros rápidos da cópia (as abas): todos, sugestões para você, em comum
 * e `theirs` — os seus itens que são sugestão para os outros. `person`: só os
 * itens de alguém (a legenda).
 */
export interface MatchFilter {
  mode: "all" | "common" | "suggestions" | "theirs"
  person: string | null
}

export const EMPTY_MATCH_FILTER: MatchFilter = { mode: "all", person: null }

export function isMatchFilterActive(filter: MatchFilter): boolean {
  return filter.mode !== "all" || filter.person !== null
}

export function applyMatchFilter<T extends { match?: EntryMatch | null }>(
  views: T[],
  filter: MatchFilter
): T[] {
  if (!isMatchFilterActive(filter)) return views
  return views.filter((view) => {
    const match = view.match
    if (!match) return false
    if (filter.person !== null && match.ownerId !== filter.person) return false
    if (filter.mode === "common") return match.common
    if (filter.mode === "suggestions") return match.suggestionForMe
    if (filter.mode === "theirs") return match.isMine && match.suggestionFor.length > 0
    return true
  })
}

/** A frase da plaqueta de um item que é sugestão ("Sugestão para você: …"). */
export function suggestionText(entry: Pick<EntryMatch, "suggestionFor" | "suggestionForMe">): string {
  if (entry.suggestionFor.length === 0) return ""
  const min = `tem nota ${SUGGESTION_MIN_RATING} ou mais`
  const people = entry.suggestionFor.join(", ")
  if (entry.suggestionForMe) {
    return entry.suggestionFor.length === 1
      ? `Sugestão para você: ${min}, e você ainda não tem.`
      : `Sugestão para ${people}: ${min}, e vocês ainda não têm.`
  }
  return entry.suggestionFor.length === 1
    ? `Sugestão para ${people}: ${min}, e ${people} ainda não tem.`
    : `Sugestão para ${people}: ${min}, e falta na coleção de cada um.`
}

/** "de @ana", "seu" (ou "conta excluída") — quem é dono de um item da cópia. */
export function matchOwnerText(match: Pick<EntryMatch, "isMine" | "ownerLabel">): string {
  if (match.isMine) return "seu"
  return match.ownerLabel.startsWith("@") ? `de ${match.ownerLabel}` : match.ownerLabel
}
