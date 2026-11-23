/**
 * A imagem da lista (Story 9:16, 1080×1920): o que está na tela da categoria
 * — a subpasta aberta, o filtro e a ordem — em Grade, Lista ou Tier list, do
 * tamanho escolhido. Aqui ficam as contas (quantos cabem, o tamanho de cada
 * foto, o "+N" e o texto do filtro); o desenho é o `ListStoryImage`.
 */

import type { CategoryFilter, SortKey } from "./filter"
import { formatRating } from "./format"
import type { GridSize } from "./grid-size"
import { groupByTier, type Tier } from "./tiers"
import type { EntryView, Tag } from "./types"

/** Os itens que a imagem desenha, em ordem (para buscar as fotos de uma vez). */
export function storyItems(plan: StoryPlan): EntryView[] {
  return plan.mode === "tier" ? plan.rows.flatMap((row) => row.shown) : plan.shown
}

export type StoryMode = "grid" | "list" | "tier"

/** O espaço dos itens, entre o topo (quem, o nome, o filtro) e o rodapé (o QR). */
export const STORY_BODY = { width: 936, height: 1060 }

/** A grade: colunas × linhas, o espaço entre as fotos e a altura do nome embaixo. */
export const STORY_GRID: Record<
  GridSize,
  { cols: number; rows: number; gap: number; name: number }
> = {
  large: { cols: 2, rows: 2, gap: 28, name: 52 },
  medium: { cols: 3, rows: 3, gap: 24, name: 44 },
  small: { cols: 4, rows: 4, gap: 18, name: 36 },
}

/** A lista: quantas linhas (contando a do "+N"), a altura de cada uma e o espaço entre elas. */
export const STORY_LIST = { rows: 8, height: 108, gap: 14, thumb: 84 }

/** O tier list: a caixa da letra, quantas miniaturas por fileira e os espaços. */
export const STORY_TIER = {
  label: 112,
  gap: 12,
  pad: 12,
  thumbGap: 10,
  perRow: { large: 4, medium: 6, small: 8 } as Record<GridSize, number>,
}

/** A faixa dos itens sem nota no tier list (como na tela). */
export const UNRATED_LABEL = "Sem nota"

/** `?vista=`: o modo da imagem. O tier list só numa categoria com estrelas. */
export function storyModeOf(raw: unknown, ratingEnabled: boolean): StoryMode {
  if (raw === "list") return "list"
  if (raw === "tier" && ratingEnabled) return "tier"
  return "grid"
}

/** Até `slots` lugares: cabendo, todos; senão, `slots - 1` itens e o "+N" no último lugar. */
export function fitSlots<T>(items: T[], slots: number): { shown: T[]; more: number } {
  if (items.length <= slots) return { shown: items, more: 0 }
  const shown = items.slice(0, Math.max(0, slots - 1))
  return { shown, more: items.length - shown.length }
}

/** O lado de cada foto (quadrada) da grade: o que couber na largura e na altura. */
export function storyGridCell(size: GridSize): number {
  const { cols, rows, gap, name } = STORY_GRID[size]
  const byWidth = (STORY_BODY.width - gap * (cols - 1)) / cols
  const byHeight = (STORY_BODY.height - gap * (rows - 1)) / rows - name
  return Math.floor(Math.min(byWidth, byHeight))
}

export interface StoryTierRow {
  /** `null`: a faixa "Sem nota". */
  tier: Tier | null
  shown: EntryView[]
  more: number
}

/** As fileiras do tier list que têm itens (e a "Sem nota", se houver), com o "+N" de cada. */
export function storyTierRows(items: EntryView[], size: GridSize): StoryTierRow[] {
  const { rows, unrated } = groupByTier(items)
  const perRow = STORY_TIER.perRow[size]
  const filled: StoryTierRow[] = rows
    .filter((row) => row.views.length > 0)
    .map((row) => ({ tier: row.tier, ...fitSlots(row.views, perRow) }))
  return unrated.length > 0 ? [...filled, { tier: null, ...fitSlots(unrated, perRow) }] : filled
}

/** O lado de cada miniatura (quadrada) do tier list, com `rowCount` fileiras na imagem. */
export function storyTierThumb(size: GridSize, rowCount: number): number {
  const { label, gap, pad, thumbGap, perRow } = STORY_TIER
  const per = perRow[size]
  const rows = Math.max(1, rowCount)
  const byWidth = (STORY_BODY.width - label - gap - pad * 2 - thumbGap * (per - 1)) / per
  const byHeight = (STORY_BODY.height - gap * (rows - 1)) / rows - pad * 2
  return Math.floor(Math.min(byWidth, byHeight))
}

export type StoryPlan =
  | { mode: "grid"; shown: EntryView[]; more: number }
  | { mode: "list"; shown: EntryView[]; more: number }
  | { mode: "tier"; rows: StoryTierRow[] }

/** O que a imagem mostra (o resto vira "+N"). */
export function storyPlan(mode: StoryMode, size: GridSize, items: EntryView[]): StoryPlan {
  if (mode === "tier") return { mode, rows: storyTierRows(items, size) }
  if (mode === "list") return { mode, ...fitSlots(items, STORY_LIST.rows) }
  const { cols, rows } = STORY_GRID[size]
  return { mode, ...fitSlots(items, cols * rows) }
}

/**
 * O recorte embaixo do nome, em palavras curtas: a busca, a faixa de nota e as
 * tags (até 3, o resto vira "+N tags"). Sem filtro, nada.
 */
export function storyFilterChips(
  filter: Pick<CategoryFilter, "query" | "minRating" | "maxRating" | "tagIds">,
  tags: Pick<Tag, "id" | "name">[],
  ratingEnabled: boolean
): string[] {
  const chips: string[] = []
  const query = filter.query.trim()
  if (query) chips.push(`“${query}”`)

  if (ratingEnabled) {
    const parse = (raw: string) => {
      const value = Number(raw.trim().replace(",", "."))
      return raw.trim() && Number.isFinite(value) ? value : null
    }
    const min = parse(filter.minRating)
    const max = parse(filter.maxRating)
    if (min !== null && max !== null) chips.push(`nota ${formatRating(min)} a ${formatRating(max)}`)
    else if (min !== null) chips.push(`nota ${formatRating(min)} ou mais`)
    else if (max !== null) chips.push(`nota até ${formatRating(max)}`)
  }

  const names = filter.tagIds
    .map((id) => tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  chips.push(...names.slice(0, 3).map((name) => `#${name}`))
  if (names.length > 3) chips.push(`+${names.length - 3} tags`)
  return chips
}

/**
 * O endereço da imagem do que está na tela: a exibição, o tamanho, a subpasta
 * e o filtro com os mesmos parâmetros que a página põe na URL (a rota refaz o
 * recorte no servidor, com o que a pessoa pode ver).
 */
export function storyHref(
  categoryId: string,
  options: {
    mode: StoryMode
    size: GridSize
    folderId: string | null
    filter: CategoryFilter
    defaultSort: SortKey
  }
): string {
  const { filter } = options
  const params = new URLSearchParams({ vista: options.mode, tamanho: options.size })
  const set = (key: string, value: string) => {
    if (value) params.set(key, value)
  }
  set("pasta", options.folderId ?? "")
  set("q", filter.query.trim())
  set("min", filter.minRating.trim())
  set("max", filter.maxRating.trim())
  set("tags", filter.tagIds.join(","))
  set("modo", filter.mode === "and" ? "" : filter.mode)
  set("ordem", filter.sort === options.defaultSort ? "" : filter.sort)
  return `/categoria/${encodeURIComponent(categoryId)}/story?${params.toString()}`
}

/** O nome do PNG baixado: `vitrine-cafes-de-sp.png`. */
export function storyFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `vitrine-${slug || "lista"}.png`
}
