/**
 * O feed do Início: o que quem você segue acabou de catalogar. A leitura é
 * a de sempre (os itens, pela RLS: só o que você pode ver); aqui ficam a
 * conferência das linhas e o agrupamento — os itens de uma pessoa, numa
 * categoria, no mesmo dia, viram um cartão só ("adicionou 5 itens em Cafés").
 */

import { imageTransformOf } from "./view"

export interface FeedPerson {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface FeedEntry {
  id: string
  name: string
  rating: number | null
  imageUrl: string | null
  imageTransform: string
  createdAt: string
  category: { id: string; name: string; icon: string | null; ratingEnabled: boolean }
  owner: FeedPerson
}

export interface FeedGroup {
  /** Pessoa + categoria + dia. */
  key: string
  owner: FeedPerson
  category: FeedEntry["category"]
  /** Do mais novo para o mais velho. */
  entries: FeedEntry[]
  latestAt: string
}

/** Quantos dias para trás o feed olha. */
export const FEED_DAYS = 30

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function one(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null
}

/** As linhas do banco (item + categoria + dono), conferidas campo a campo. */
export function parseFeedRows(raw: unknown): FeedEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): FeedEntry[] => {
    const row = one(item)
    const category = one(row?.category)
    const owner = one(row?.owner)
    const id = text(row?.id)
    const createdAt = text(row?.created_at)
    const categoryId = text(category?.id)
    const ownerId = text(owner?.id)
    const username = text(owner?.username)
    if (!row || !id || !createdAt || !categoryId || !ownerId || !username) return []
    const rating = row.rating === null || row.rating === undefined ? null : Number(row.rating)
    return [
      {
        id,
        name: text(row.name) ?? "Sem nome",
        rating: rating !== null && Number.isFinite(rating) && rating > 0 ? rating : null,
        imageUrl: text(row.image_url),
        imageTransform: imageTransformOf(row.image_display),
        createdAt,
        category: {
          id: categoryId,
          name: text(category?.name) ?? "Categoria",
          icon: text(category?.icon),
          ratingEnabled: category?.rating_enabled !== false,
        },
        owner: {
          id: ownerId,
          username,
          display_name: text(owner?.display_name),
          avatar_url: text(owner?.avatar_url),
        },
      },
    ]
  })
}

const DAY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
})

/**
 * Junta os itens de uma pessoa numa categoria, no mesmo dia (de São Paulo),
 * num cartão só. Os cartões saem do mais novo para o mais velho.
 */
export function groupFeed(entries: FeedEntry[]): FeedGroup[] {
  const groups = new Map<string, FeedGroup>()
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  for (const entry of sorted) {
    const day = DAY.format(new Date(entry.createdAt))
    const key = `${entry.owner.id}|${entry.category.id}|${day}`
    const group = groups.get(key)
    if (group) group.entries.push(entry)
    else {
      groups.set(key, {
        key,
        owner: entry.owner,
        category: entry.category,
        entries: [entry],
        latestAt: entry.createdAt,
      })
    }
  }
  return [...groups.values()]
}

/** As pessoas com novidade, na ordem do feed (sem repetir) — as bolinhas do topo. */
export function feedPeople(groups: FeedGroup[], max = 12): FeedPerson[] {
  const seen = new Set<string>()
  const people: FeedPerson[] = []
  for (const group of groups) {
    if (seen.has(group.owner.id)) continue
    seen.add(group.owner.id)
    people.push(group.owner)
    if (people.length === max) break
  }
  return people
}

/** "adicionou 5 itens em" / "adicionou em" (um item só). */
export function feedAction(count: number): string {
  return count === 1 ? "adicionou em" : `adicionou ${count} itens em`
}
