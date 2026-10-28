/**
 * O Match no modelo do Blend do Spotify: uma lista só, a MESMA para todo
 * mundo do match, que mistura o gosto de cada um e muda um pouco a cada dia,
 * e a % de compatibilidade com o "por quê". A base vem do banco
 * (`match_blend_pool`, migração 45 — só o que todos do match podem ver);
 * aqui ficam os pontos, as cotas, a ordem e as contas.
 */

import { plural } from "./format"
import type { ImageDisplay } from "./types"

// ---------------------------------------------------------------------------
// A base
// ---------------------------------------------------------------------------

export interface BlendItem {
  entryId: string
  ownerId: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  /** A "família" da categoria: o nome normalizado que junta as equivalentes. */
  family: string
  /** A família é de 2+ pessoas do match. Senão, o item só pode ser descoberta. */
  shared: boolean
  /** A "mesma coisa" entre pessoas: o mesmo lugar, ou o mesmo título na mesma família. */
  key: string
  name: string
  rating: number | null
  imageUrl: string | null
  imageDisplay: ImageDisplay | null
  updatedAt: string
}

export interface BlendPool {
  items: BlendItem[]
  /** As famílias de cada pessoa (inclusive as que não têm item na base). */
  families: Map<string, Set<string>>
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function ratingOf(value: unknown): number | null {
  const rating = value === null || value === undefined ? null : Number(value)
  return rating !== null && Number.isFinite(rating) && rating > 0 ? rating : null
}

/** O jsonb da `match_blend_pool` → a base. `null`: o match não é seu ou não está pronto. */
export function parseBlendPool(raw: unknown): BlendPool | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>

  const families = new Map<string, Set<string>>()
  for (const value of Array.isArray(data.families) ? data.families : []) {
    const row = value as Record<string, unknown> | null
    const ownerId = text(row?.owner_id)
    const family = text(row?.family)
    if (!ownerId || !family) continue
    families.set(ownerId, (families.get(ownerId) ?? new Set<string>()).add(family))
  }

  const items = (Array.isArray(data.items) ? data.items : []).flatMap((value): BlendItem[] => {
    const row = value as Record<string, unknown> | null
    const entryId = text(row?.entry_id)
    const ownerId = text(row?.owner_id)
    const categoryId = text(row?.category_id)
    const family = text(row?.family)
    const key = text(row?.match_key)
    if (!row || !entryId || !ownerId || !categoryId || !family || !key) return []
    const display = row.image_display
    return [
      {
        entryId,
        ownerId,
        categoryId,
        categoryName: text(row.category_name) ?? "Categoria",
        categoryIcon: text(row.category_icon),
        family,
        shared: row.shared === true,
        key,
        name: text(row.name) ?? "Sem nome",
        rating: ratingOf(row.rating),
        imageUrl: text(row.image_url),
        imageDisplay:
          display && typeof display === "object" && !Array.isArray(display)
            ? (display as ImageDisplay)
            : null,
        updatedAt: text(row.updated_at) ?? "",
      },
    ]
  })

  return { items, families }
}

// ---------------------------------------------------------------------------
// A compatibilidade
// ---------------------------------------------------------------------------

/** O peso de cada parte da %: mundos (categorias), itens e notas. */
export const TASTE_WEIGHTS = { worlds: 0.2, items: 0.4, ratings: 0.4 }
/**
 * Itens: a partir desta semelhança já vale a parte inteira. Mesmo gente
 * muito parecida raramente tem mais da metade do acervo igual.
 */
const ITEMS_FULL = 0.5
/** Com menos itens avaliados pelos dois, as notas não contam (o peso vai para os itens). */
const MIN_RATED = 3
/** A maior distância possível entre duas notas (0,5 a 5). */
const RATING_SPAN = 4.5

export interface PairTaste {
  a: string
  b: string
  /** 0 a 100. */
  percent: number
  commonFamilies: number
  commonItems: number
  ratedBoth: number
  /** 0 a 100 — quanto as notas batem; `null` = poucos itens com nota dos dois. */
  agreement: number | null
  /** 0 a 100 — as outras duas partes da %, para o "Por quê?". */
  worlds: number
  items: number
}

/** Semelhança de dois conjuntos de tamanhos diferentes (Ochiai): em comum ÷ √(A × B). */
function overlap(common: number, sizeA: number, sizeB: number): number {
  return sizeA > 0 && sizeB > 0 ? common / Math.sqrt(sizeA * sizeB) : 0
}

/** A nota de cada "coisa" de uma pessoa (a mesma coisa duas vezes: vale a maior). */
function ratingsByKey(items: BlendItem[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const item of items) {
    const current = map.get(item.key)
    map.set(item.key, current == null ? item.rating : Math.max(current, item.rating ?? current))
  }
  return map
}

/**
 * A % de um par, em três partes de 0 a 1:
 *   mundos = famílias em comum ÷ √(famílias de A × famílias de B);
 *   itens  = itens em comum ÷ √(itens de A × itens de B), nas famílias em
 *            comum, ÷ 0,5 (no máximo 1);
 *   notas  = média de 1 − |nota A − nota B| ÷ 4,5 nos itens com nota dos dois.
 * % = 20% mundos + 40% itens + 40% notas (com menos de 3 itens avaliados pelos
 * dois, 20% mundos + 80% itens).
 */
export function pairTaste(pool: BlendPool, a: string, b: string): PairTaste {
  const familiesA = pool.families.get(a) ?? new Set<string>()
  const familiesB = pool.families.get(b) ?? new Set<string>()
  const commonFamilies = new Set([...familiesA].filter((family) => familiesB.has(family)))

  const inCommon = (owner: string) =>
    pool.items.filter((item) => item.ownerId === owner && commonFamilies.has(item.family))
  const ratingsA = ratingsByKey(inCommon(a))
  const ratingsB = ratingsByKey(inCommon(b))
  const commonKeys = [...ratingsA.keys()].filter((key) => ratingsB.has(key))
  const distances = commonKeys.flatMap((key) => {
    const ra = ratingsA.get(key)
    const rb = ratingsB.get(key)
    return ra != null && rb != null ? [Math.max(0, 1 - Math.abs(ra - rb) / RATING_SPAN)] : []
  })

  const worlds = overlap(commonFamilies.size, familiesA.size, familiesB.size)
  const items = Math.min(1, overlap(commonKeys.length, ratingsA.size, ratingsB.size) / ITEMS_FULL)
  const agreement =
    distances.length >= MIN_RATED
      ? distances.reduce((sum, value) => sum + value, 0) / distances.length
      : null
  const value =
    agreement === null
      ? TASTE_WEIGHTS.worlds * worlds + (TASTE_WEIGHTS.items + TASTE_WEIGHTS.ratings) * items
      : TASTE_WEIGHTS.worlds * worlds +
        TASTE_WEIGHTS.items * items +
        TASTE_WEIGHTS.ratings * agreement

  return {
    a,
    b,
    percent: Math.round(value * 100),
    commonFamilies: commonFamilies.size,
    commonItems: commonKeys.length,
    ratedBoth: distances.length,
    agreement: agreement === null ? null : Math.round(agreement * 100),
    worlds: Math.round(worlds * 100),
    items: Math.round(items * 100),
  }
}

export interface BlendTaste {
  /** A % do match: a do par, ou a média dos pares num grupo. */
  percent: number | null
  pairs: PairTaste[]
  /** O par mais parecido (num grupo). */
  best: PairTaste | null
}

export function blendTaste(pool: BlendPool, memberIds: string[]): BlendTaste {
  const pairs: PairTaste[] = []
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      pairs.push(pairTaste(pool, memberIds[i], memberIds[j]))
    }
  }
  if (pairs.length === 0) return { percent: null, pairs, best: null }
  const percent = Math.round(pairs.reduce((sum, pair) => sum + pair.percent, 0) / pairs.length)
  const best = pairs.reduce((top, pair) => (pair.percent > top.percent ? pair : top))
  return { percent, pairs, best }
}

// ---------------------------------------------------------------------------
// O que une vocês
// ---------------------------------------------------------------------------

export interface BlendHighlights {
  /** A categoria com mais coisas em comum (o nome mais curto da família). */
  family: { name: string; icon: string | null; common: number } | null
  /**
   * A coisa em comum com a maior nota de todos (a menor nota entre quem tem);
   * no empate, a da categoria que mais une.
   */
  item: { item: BlendItem; owners: { userId: string; rating: number }[] } | null
}

/** Os itens de cada "coisa", agrupados pela chave. */
function byKey(items: BlendItem[]): Map<string, BlendItem[]> {
  const map = new Map<string, BlendItem[]>()
  for (const item of items) map.set(item.key, [...(map.get(item.key) ?? []), item])
  return map
}

/** O item que aparece: com imagem, de preferência, e o de nota maior. */
function showcase(items: BlendItem[]): BlendItem {
  return [...items].sort(
    (x, y) =>
      Number(Boolean(y.imageUrl)) - Number(Boolean(x.imageUrl)) || (y.rating ?? 0) - (x.rating ?? 0)
  )[0]
}

/** A nota de cada pessoa que tem (a maior dela), na ordem de quem tem. */
function ownerRatings(items: BlendItem[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const item of items) {
    const current = map.get(item.ownerId)
    map.set(item.ownerId, current == null ? item.rating : Math.max(current, item.rating ?? current))
  }
  return map
}

export function blendHighlights(pool: BlendPool): BlendHighlights {
  const groups = [...byKey(pool.items).values()].filter(
    (items) => new Set(items.map((item) => item.ownerId)).size >= 2
  )

  const commonByFamily = new Map<string, number>()
  for (const items of groups) {
    commonByFamily.set(items[0].family, (commonByFamily.get(items[0].family) ?? 0) + 1)
  }
  const topFamily = [...commonByFamily.entries()].sort(
    (x, y) => y[1] - x[1] || x[0].localeCompare(y[0])
  )[0]
  const familyItems = topFamily ? pool.items.filter((item) => item.family === topFamily[0]) : []
  const named = [...familyItems].sort(
    (x, y) =>
      x.categoryName.length - y.categoryName.length || x.categoryName.localeCompare(y.categoryName)
  )[0]

  const scored = groups.flatMap((items) => {
    const owners = [...ownerRatings(items).entries()].map(([userId, rating]) => ({
      userId,
      rating,
    }))
    if (owners.some((owner) => owner.rating === null)) return []
    const values = owners.map((owner) => owner.rating as number)
    return [
      {
        items,
        owners: owners as { userId: string; rating: number }[],
        min: Math.min(...values),
        mean: values.reduce((sum, value) => sum + value, 0) / values.length,
      },
    ]
  })
  const top = scored.sort(
    (x, y) =>
      y.min - x.min ||
      y.mean - x.mean ||
      Number(y.items[0].family === topFamily?.[0]) - Number(x.items[0].family === topFamily?.[0]) ||
      y.owners.length - x.owners.length ||
      x.items[0].name.localeCompare(y.items[0].name)
  )[0]

  return {
    family:
      topFamily && named
        ? { name: named.categoryName, icon: named.categoryIcon, common: topFamily[1] }
        : null,
    item: top ? { item: showcase(top.items), owners: top.owners } : null,
  }
}

// ---------------------------------------------------------------------------
// A lista do dia
// ---------------------------------------------------------------------------

/** 30 itens em dupla; cada pessoa a mais soma 5, até 50. */
export const BLEND_BASE_SIZE = 30
export const BLEND_PER_EXTRA = 5
export const BLEND_MAX_SIZE = 50

export function blendSize(members: number): number {
  return Math.min(BLEND_MAX_SIZE, BLEND_BASE_SIZE + BLEND_PER_EXTRA * Math.max(0, members - 2))
}

/** A nota mínima para virar sugestão ou descoberta. */
export const BLEND_MIN_PICK_RATING = 4
/** Em comum, mas todo mundo que deu nota deu menos que isto: fica de fora. */
const BLEND_MIN_COMMON_RATING = 3
/** Mexido nestes dias: o "ouviu há pouco" do Blend, um bônus. */
const BLEND_RECENT_DAYS = 30
/** As fatias da lista. O resto é das sugestões, repartidas igual entre as pessoas. */
const BLEND_COMMON_SHARE = 0.4
const BLEND_DISCOVERY_SHARE = 0.1
/** Nenhuma família passa de 1/3 da lista (os 72 filmes não engolem as cervejas). */
const BLEND_FAMILY_SHARE = 1 / 3

export type BlendKind = "common" | "suggestion" | "discovery"

export interface BlendPick {
  key: string
  kind: BlendKind
  /** O item que aparece (com imagem, de preferência). */
  item: BlendItem
  /** Quem tem, na ordem do match, com a nota de cada um. */
  owners: { userId: string; rating: number | null; entryId: string }[]
  score: number
}

/** O dia de São Paulo ("2026-10-28"): a lista muda quando ele muda. */
const DAY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
})

export function blendDay(now: Date): string {
  return DAY.format(now)
}

/** Um número de 0 a 1 que só depende do texto (FNV-1a): o "sorteio" do dia. */
function seeded(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

/** Quanto o sorteio do dia mexe nos pontos: pouco nos em comum, mais nas sugestões. */
const JITTER: Record<BlendKind, number> = { common: 0.5, suggestion: 1.5, discovery: 1.5 }

function candidatesOf(pool: BlendPool, memberIds: string[], seed: string, now: Date): BlendPick[] {
  const order = new Map(memberIds.map((id, index) => [id, index]))
  const recentSince = now.getTime() - BLEND_RECENT_DAYS * 24 * 60 * 60 * 1000

  return [...byKey(pool.items.filter((item) => order.has(item.ownerId))).values()].flatMap(
    (items): BlendPick[] => {
      const ratings = ownerRatings(items)
      const owners = [...ratings.entries()]
        .sort((x, y) => (order.get(x[0]) ?? 0) - (order.get(y[0]) ?? 0))
        .map(([userId, rating]) => ({
          userId,
          rating,
          entryId: items.find((item) => item.ownerId === userId)!.entryId,
        }))
      const key = items[0].key
      const jitter = (kind: BlendKind) => seeded(`${seed}|${key}`) * JITTER[kind]

      if (owners.length >= 2) {
        const rated = owners.flatMap((owner) => (owner.rating === null ? [] : [owner.rating]))
        if (rated.length > 0 && rated.every((rating) => rating < BLEND_MIN_COMMON_RATING)) return []
        // Sem nota de ninguém: entra, mas depois dos avaliados.
        const base = rated.length > 0 ? rated.reduce((s, v) => s + v, 0) / rated.length : 2.5
        const score = base + 0.5 * (owners.length - 1) + jitter("common")
        return [{ key, kind: "common", item: showcase(items), owners, score }]
      }

      const [owner] = owners
      if (owner.rating === null || owner.rating < BLEND_MIN_PICK_RATING) return []
      const kind: BlendKind = items.some((item) => item.shared) ? "suggestion" : "discovery"
      const recent = items.some((item) => Date.parse(item.updatedAt) >= recentSince)
      const score = owner.rating + (recent ? 0.5 : 0) + jitter(kind)
      return [{ key, kind, item: showcase(items), owners, score }]
    }
  )
}

/**
 * A lista do dia. A mesma para todo mundo do match (a base é a mesma e o
 * sorteio só depende de `seed` — use o match + `blendDay`):
 *   • ~40% em comum, ~10% descobertas (de categorias que só uma pessoa tem) e
 *     o resto sugestões, cada pessoa com a mesma quantidade (vez por vez);
 *   • nenhuma família passa de 1/3 da lista;
 *   • a ordem intercala as fatias e evita duas seguidas da mesma família.
 * Faltou de uma fatia? As outras completam.
 */
export function buildBlend(input: {
  pool: BlendPool
  memberIds: string[]
  seed: string
  now: Date
}): BlendPick[] {
  const { pool, memberIds, seed, now } = input
  const size = blendSize(memberIds.length)
  const familyCap = Math.ceil(size * BLEND_FAMILY_SHARE)
  const byScore = (x: BlendPick, y: BlendPick) => y.score - x.score || x.key.localeCompare(y.key)
  const candidates = candidatesOf(pool, memberIds, seed, now).sort(byScore)

  const chosen: BlendPick[] = []
  const used = new Set<string>()
  const perFamily = new Map<string, number>()
  const fits = (pick: BlendPick) =>
    !used.has(pick.key) && (perFamily.get(pick.item.family) ?? 0) < familyCap
  const take = (pick: BlendPick) => {
    chosen.push(pick)
    used.add(pick.key)
    perFamily.set(pick.item.family, (perFamily.get(pick.item.family) ?? 0) + 1)
  }

  // Em comum: os melhores.
  const commonQuota = Math.round(size * BLEND_COMMON_SHARE)
  for (const pick of candidates) {
    if (chosen.length >= commonQuota) break
    if (pick.kind === "common" && fits(pick)) take(pick)
  }

  // Sugestões e descobertas: vez por vez, cada pessoa coloca a melhor dela.
  // A vez continua de uma fatia para a outra, para ninguém colocar mais.
  let turn = 0
  const roundRobin = (kind: BlendKind, quota: number) => {
    let placed = 0
    let idle = 0
    while (placed < quota && idle < memberIds.length) {
      const member = memberIds[turn % memberIds.length]
      turn++
      const pick = candidates.find(
        (option) => option.kind === kind && option.owners[0].userId === member && fits(option)
      )
      if (pick) {
        take(pick)
        placed++
        idle = 0
      } else {
        idle++
      }
    }
  }
  const discoveryQuota = Math.round(size * BLEND_DISCOVERY_SHARE)
  roundRobin("suggestion", size - commonQuota - discoveryQuota)
  roundRobin("discovery", discoveryQuota)

  // Faltou de alguma fatia: completa com o que sobrou, pelos pontos.
  for (const pick of candidates) {
    if (chosen.length >= size) break
    if (fits(pick)) take(pick)
  }

  return interleave(chosen, memberIds)
}

/**
 * A ordem: uma fila para os em comum e uma por pessoa (as sugestões e as
 * descobertas dela), cada uma pelos pontos. A cada posição, sai da fila que
 * está mais "atrasada" (a maior fração ainda por sair) — assim as fatias se
 * espalham pela lista — e, dela, o primeiro item de outra família que a do
 * anterior (se houver).
 */
function interleave(picks: BlendPick[], memberIds: string[]): BlendPick[] {
  const byScore = (x: BlendPick, y: BlendPick) => y.score - x.score || x.key.localeCompare(y.key)
  const queues = [
    picks.filter((pick) => pick.kind === "common").sort(byScore),
    ...memberIds.map((member) =>
      picks
        .filter((pick) => pick.kind !== "common" && pick.owners[0].userId === member)
        .sort(byScore)
    ),
  ].filter((queue) => queue.length > 0)
  const totals = queues.map((queue) => queue.length)

  const out: BlendPick[] = []
  while (out.length < picks.length) {
    let next = -1
    for (let i = 0; i < queues.length; i++) {
      if (queues[i].length === 0) continue
      if (next === -1 || queues[i].length / totals[i] > queues[next].length / totals[next]) next = i
    }
    const queue = queues[next]
    const last = out[out.length - 1]?.item.family
    const index = Math.max(
      0,
      queue.findIndex((pick) => pick.item.family !== last)
    )
    out.push(queue.splice(index, 1)[0])
  }
  return out
}

// ---------------------------------------------------------------------------
// Os textos da tela
// ---------------------------------------------------------------------------

/** O recado de quando a migração 45 ainda não rodou. */
export const BLEND_NOT_READY =
  "A lista do match ainda não está no banco: rode supabase/45_match_blend.sql no SQL Editor do Supabase."

/** "a", "a e b", "a, b e c". */
function joinLabels(labels: string[]): string {
  return labels.length <= 1
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`
}

/** "Vocês têm 10 categorias em comum e 54 itens iguais, e as notas batem em 83%." */
export function tasteWhy(pair: PairTaste): string {
  if (pair.commonFamilies === 0) return "Vocês ainda não têm nenhuma categoria em comum."
  const families = plural(pair.commonFamilies, "categoria em comum", "categorias em comum")
  const items =
    pair.commonItems === 0
      ? "nenhum item igual"
      : plural(pair.commonItems, "item igual", "itens iguais")
  const ratings =
    pair.agreement === null
      ? ", mas ainda poucas notas para comparar"
      : `, e as notas batem em ${pair.agreement}%`
  return `Vocês têm ${families} e ${items}${ratings}.`
}

/** O tipo de cada item da lista (quem colocou aparece ao lado, com a nota). */
export const BLEND_KIND_LABEL: Record<BlendKind, string> = {
  common: "Em comum",
  suggestion: "Sugestão",
  discovery: "Descoberta",
}

/** Quem está no match, para o story: "@a e @b", "@a, @b e @c", "@a, @b, @c e mais 2". */
export function blendPeopleLabel(usernames: string[]): string {
  const handles = usernames.map((username) => `@${username}`)
  if (handles.length <= 4) return joinLabels(handles)
  return `${handles.slice(0, 3).join(", ")} e mais ${handles.length - 3}`
}
