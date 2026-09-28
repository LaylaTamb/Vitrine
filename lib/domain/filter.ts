/**
 * O motor do filtro. Roda 100% na memória do cliente: o Server Component
 * entrega a categoria (ou o acervo) inteira e daqui para frente digitar na
 * busca não gera requisição nenhuma.
 */

import { isNumericField, normalizeName } from "./fields"
import { FIELD_TYPE_LABELS } from "./fields"
import type { Category, EntryView, FieldType, Tag } from "./types"

// ---------------------------------------------------------------------------
// Filtro de uma categoria
// ---------------------------------------------------------------------------

export type SortKey = "recent" | "rating_desc" | "rating_asc" | "name_asc"

/**
 * Como as regras marcadas se combinam. `and`: o item precisa bater com TODAS
 * as tags (e, no filtro geral, com todos os campos ativos). `or`: basta uma.
 */
export type MatchMode = "and" | "or"

export const MATCH_MODE_OPTIONS: { value: MatchMode; label: string; hint: string }[] = [
  { value: "and", label: "E", hint: "precisa bater com todas" },
  { value: "or", label: "OU", hint: "basta bater com uma" },
]

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Adicionados recentemente" },
  { value: "rating_desc", label: "Nota (maior primeiro)" },
  { value: "rating_asc", label: "Nota (menor primeiro)" },
  { value: "name_asc", label: "Nome (A-Z)" },
]

export interface CategoryFilter {
  query: string
  minRating: string
  maxRating: string
  tagIds: string[]
  sort: SortKey
  /** Como as tags marcadas se combinam. */
  mode: MatchMode
}

export const EMPTY_CATEGORY_FILTER: CategoryFilter = {
  query: "",
  minRating: "",
  maxRating: "",
  tagIds: [],
  sort: "recent",
  mode: "and",
}

const SORT_KEYS: SortKey[] = ["recent", "rating_desc", "rating_asc", "name_asc"]

/** A URL de uma categoria (`?q=&min=&max=&tags=&modo=&ordem=`) virando filtro. */
export function categoryFilterFromParams(params: {
  q?: string | null
  min?: string | null
  max?: string | null
  tags?: string | null
  modo?: string | null
  ordem?: string | null
}): CategoryFilter {
  return {
    query: params.q ?? "",
    minRating: params.min ?? "",
    maxRating: params.max ?? "",
    tagIds: (params.tags ?? "").split(",").filter(Boolean),
    sort: SORT_KEYS.find((key) => key === params.ordem) ?? "recent",
    mode: params.modo === "or" ? "or" : "and",
  }
}

/** Ordenação e modo não contam como filtro: sozinhos, não escondem item nenhum. */
export function isCategoryFilterActive(filter: CategoryFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.minRating.trim() !== "" ||
    filter.maxRating.trim() !== "" ||
    filter.tagIds.length > 0
  )
}

function toNumber(raw: string): number | null {
  const text = raw.trim().replace(",", ".")
  if (text === "") return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

/** Ordena sempre com item sem nota no fim, nos dois sentidos. */
function sortViews(views: EntryView[], sort: SortKey): EntryView[] {
  const out = [...views]
  switch (sort) {
    case "rating_desc":
      out.sort((a, b) => {
        if (a.rating === null && b.rating === null) return a.name.localeCompare(b.name, "pt-BR")
        if (a.rating === null) return 1
        if (b.rating === null) return -1
        return b.rating - a.rating || a.name.localeCompare(b.name, "pt-BR")
      })
      break
    case "rating_asc":
      out.sort((a, b) => {
        if (a.rating === null && b.rating === null) return a.name.localeCompare(b.name, "pt-BR")
        if (a.rating === null) return 1
        if (b.rating === null) return -1
        return a.rating - b.rating || a.name.localeCompare(b.name, "pt-BR")
      })
      break
    case "name_asc":
      out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      break
    case "recent":
    default:
      out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      break
  }
  return out
}

/**
 * A busca livre procura no nome, nos nomes das tags e em todos os valores de
 * campo do item — tudo pré-concatenado em `view.search`. Vários termos
 * separados por espaço são combinados com AND.
 */
export function matchesQuery(view: EntryView, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  return terms.every((term) => view.search.includes(term))
}

export function applyCategoryFilter(views: EntryView[], filter: CategoryFilter): EntryView[] {
  const min = toNumber(filter.minRating)
  const max = toNumber(filter.maxRating)
  const tagIds = filter.tagIds

  const filtered = views.filter((view) => {
    if (!matchesQuery(view, filter.query)) return false

    if (min !== null) {
      if (view.rating === null || view.rating < min) return false
    }
    if (max !== null) {
      if (view.rating === null || view.rating > max) return false
    }

    if (tagIds.length > 0 && !matchesTags(view, tagIds, filter.mode)) return false

    return true
  })

  return sortViews(filtered, filter.sort)
}

function hasTag(view: EntryView, tagId: string): boolean {
  return view.tags.some((tag) => tag.id === tagId)
}

/** E: o item tem todas as tags marcadas. OU: tem pelo menos uma. */
export function matchesTags(view: EntryView, tagIds: string[], mode: MatchMode): boolean {
  if (tagIds.length === 0) return true
  return mode === "or"
    ? tagIds.some((id) => hasTag(view, id))
    : tagIds.every((id) => hasTag(view, id))
}

/** As tags que realmente aparecem nos itens desta categoria. */
export function tagsPresentIn(views: EntryView[]): Tag[] {
  const seen = new Map<string, Tag>()
  for (const view of views) {
    for (const tag of view.tags) if (!seen.has(tag.id)) seen.set(tag.id, tag)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

// ---------------------------------------------------------------------------
// Filtro geral: campos unificados entre categorias
// ---------------------------------------------------------------------------

export interface UnifiedFieldCategory {
  categoryId: string
  categoryName: string
  icon: string | null
  fieldId: string
}

export interface UnifiedField {
  /** Identidade do campo: nome + tipo (+ opções, em select). */
  key: string
  /** Rótulo exibido, já desambiguado quando dois campos têm o mesmo nome. */
  label: string
  nome: string
  tipo: FieldType
  opcoes: string[]
  /** Em quais categorias esse campo existe, e com que id em cada uma. */
  categories: UnifiedFieldCategory[]
}

/**
 * Dois campos de categorias diferentes são o MESMO filtro quando nome e tipo
 * batem — e, em `select`, também a lista de opções.
 */
function identityOf(nome: string, tipo: FieldType, opcoes: string[]): string {
  const base = `${normalizeName(nome)}|${tipo}`
  if (tipo !== "select") return base
  return `${base}|${opcoes.map(normalizeName).sort().join(",")}`
}

export function unifyFields(categories: Category[]): UnifiedField[] {
  const byKey = new Map<string, UnifiedField>()

  for (const category of categories) {
    for (const field of category.estrutura) {
      const opcoes = field.opcoes ?? []
      const key = identityOf(field.nome, field.tipo, opcoes)
      const entry = byKey.get(key)
      const link: UnifiedFieldCategory = {
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        fieldId: field.id,
      }
      if (entry) {
        entry.categories.push(link)
      } else {
        byKey.set(key, {
          key,
          label: field.nome,
          nome: field.nome,
          tipo: field.tipo,
          opcoes,
          categories: [link],
        })
      }
    }
  }

  const unified = [...byKey.values()]

  // Mesmo nome com identidades diferentes: desambigua o rótulo.
  const byName = new Map<string, UnifiedField[]>()
  for (const field of unified) {
    const list = byName.get(normalizeName(field.nome)) ?? []
    list.push(field)
    byName.set(normalizeName(field.nome), list)
  }
  for (const list of byName.values()) {
    if (list.length < 2) continue
    for (const field of list) {
      const hint =
        field.tipo === "select" && field.opcoes.length > 0
          ? field.opcoes.slice(0, 2).join(", ")
          : FIELD_TYPE_LABELS[field.tipo]
      field.label = `${field.nome} (${hint})`
    }
  }

  return unified.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
}

/** O controle de um campo no filtro geral. Tudo string: vem de input. */
export interface FieldFilter {
  min: string
  max: string
  value: string
}

export const EMPTY_FIELD_FILTER: FieldFilter = { min: "", max: "", value: "" }

export type SortDir = "asc" | "desc"

export interface GlobalFilter {
  query: string
  minRating: string
  maxRating: string
  tagIds: string[]
  /** Vazio = todas. Categoria marcada entra, as outras ficam de fora. */
  categoryIds: string[]
  /** chave do campo unificado → filtro */
  fields: Record<string, FieldFilter>
  /**
   * Como as tags marcadas e os campos ativos se combinam: `and` exige todas
   * as regras, `or` aceita o item que bater com pelo menos uma. Nome, nota e
   * categoria valem sempre.
   */
  mode: MatchMode
  /** `recent` | `rating` | `name` | `campo:<chave do campo unificado>` */
  sortBy: string
  sortDir: SortDir
}

export const EMPTY_GLOBAL_FILTER: GlobalFilter = {
  query: "",
  minRating: "",
  maxRating: "",
  tagIds: [],
  categoryIds: [],
  fields: {},
  mode: "and",
  sortBy: "recent",
  sortDir: "desc",
}

/**
 * As categorias que valem agora: as marcadas, ou todas quando nenhuma está.
 * É delas — e só delas — que saem os "Campos das categorias".
 */
export function categoriesInScope(categories: Category[], categoryIds: string[]): Category[] {
  if (categoryIds.length === 0) return categories
  return categories.filter((category) => categoryIds.includes(category.id))
}

export function isFieldFilterActive(filter: FieldFilter | undefined): boolean {
  if (!filter) return false
  return (
    filter.min.trim() !== "" || filter.max.trim() !== "" || filter.value.trim() !== ""
  )
}

export function isGlobalFilterActive(filter: GlobalFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.minRating.trim() !== "" ||
    filter.maxRating.trim() !== "" ||
    filter.tagIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    Object.values(filter.fields).some(isFieldFilterActive)
  )
}

/**
 * Um campo ativo no filtro é uma regra: item que não tem esse campo, ou está
 * com ele vazio, não bate com ela. Como as regras se combinam (E/OU) é
 * decidido em `applyGlobalFilter`.
 */
function matchesField(
  view: EntryView,
  unified: UnifiedField,
  filter: FieldFilter
): boolean {
  const link = unified.categories.find((item) => item.categoryId === view.categoryId)
  if (!link) return false

  const raw = view.values[link.fieldId]
  if (raw === undefined || raw === null || raw === "") return false

  if (isNumericField(unified.tipo)) {
    const value = Number(raw)
    if (!Number.isFinite(value)) return false
    const min = toNumber(filter.min)
    const max = toNumber(filter.max)
    if (min !== null && value < min) return false
    if (max !== null && value > max) return false
    return true
  }

  if (unified.tipo === "date") {
    const value = String(raw)
    const from = filter.min.trim()
    const to = filter.max.trim()
    if (from && value < from) return false
    if (to && value > to) return false
    return true
  }

  if (unified.tipo === "select") {
    const wanted = filter.value.trim()
    if (!wanted) return true
    return String(raw) === wanted
  }

  // str: contém, sem diferenciar maiúsculas nem acento
  const wanted = normalizeName(filter.value)
  if (!wanted) return true
  return normalizeName(String(raw)).includes(wanted)
}

/**
 * Filtra o acervo inteiro. `unifiedFields` são os campos das categorias em
 * escopo: filtro de um campo que não está na lista (a categoria dele foi
 * desmarcada) é ignorado.
 *
 * Nome, nota e categoria são sempre obrigatórios. Tags marcadas e campos
 * ativos formam um grupo de regras, combinado conforme `filter.mode`.
 */
export function applyGlobalFilter(
  views: EntryView[],
  filter: GlobalFilter,
  unifiedFields: UnifiedField[]
): EntryView[] {
  const min = toNumber(filter.minRating)
  const max = toNumber(filter.maxRating)
  const activeFields = unifiedFields.filter((field) =>
    isFieldFilterActive(filter.fields[field.key])
  )

  const rules: ((view: EntryView) => boolean)[] = [
    ...filter.tagIds.map((tagId) => (view: EntryView) => hasTag(view, tagId)),
    ...activeFields.map(
      (field) => (view: EntryView) =>
        matchesField(view, field, filter.fields[field.key] ?? EMPTY_FIELD_FILTER)
    ),
  ]

  return views.filter((view) => {
    if (filter.query.trim()) {
      // No filtro geral a busca livre é pelo NOME do item.
      const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
      const name = view.name.toLowerCase()
      if (!terms.every((term) => name.includes(term))) return false
    }

    if (min !== null && (view.rating === null || view.rating < min)) return false
    if (max !== null && (view.rating === null || view.rating > max)) return false

    if (filter.categoryIds.length > 0 && !filter.categoryIds.includes(view.categoryId)) {
      return false
    }

    if (rules.length > 0) {
      const hit =
        filter.mode === "or" ? rules.some((rule) => rule(view)) : rules.every((rule) => rule(view))
      if (!hit) return false
    }

    return true
  })
}

// ---------------------------------------------------------------------------
// Ordenação do filtro geral
// ---------------------------------------------------------------------------

export const FIELD_SORT_PREFIX = "campo:"

/** Como o valor se compara — decide também o texto do botão de direção. */
export type SortKind = "date" | "number" | "text"

export interface GlobalSortOption {
  value: string
  label: string
  kind: SortKind
  /** A direção que faz sentido ao escolher essa opção. */
  defaultDir: SortDir
}

function sortKindOf(tipo: FieldType): SortKind {
  if (isNumericField(tipo)) return "number"
  if (tipo === "date") return "date"
  return "text"
}

/** As opções do "Ordenar por": as fixas e um item por campo em escopo. */
export function globalSortOptions(unifiedFields: UnifiedField[]): GlobalSortOption[] {
  return [
    { value: "recent", label: "Data de adição", kind: "date", defaultDir: "desc" },
    { value: "rating", label: "Nota", kind: "number", defaultDir: "desc" },
    { value: "name", label: "Nome", kind: "text", defaultDir: "asc" },
    ...unifiedFields.map((field): GlobalSortOption => {
      const kind = sortKindOf(field.tipo)
      return {
        value: `${FIELD_SORT_PREFIX}${field.key}`,
        label: field.label,
        kind,
        defaultDir: kind === "text" ? "asc" : "desc",
      }
    }),
  ]
}

/** "maior primeiro", "A → Z", "mais recentes primeiro"… */
export function sortDirLabel(kind: SortKind, dir: SortDir): string {
  if (kind === "text") return dir === "asc" ? "A → Z" : "Z → A"
  if (kind === "date") return dir === "desc" ? "mais recentes primeiro" : "mais antigos primeiro"
  return dir === "desc" ? "maior primeiro" : "menor primeiro"
}

type SortValue = number | string | null

function fieldValueOf(view: EntryView, field: UnifiedField): SortValue {
  const link = field.categories.find((item) => item.categoryId === view.categoryId)
  if (!link) return null
  const raw = view.values[link.fieldId]
  if (raw === undefined || raw === null || raw === "") return null
  if (isNumericField(field.tipo)) {
    const num = Number(raw)
    return Number.isFinite(num) ? num : null
  }
  return String(raw)
}

/**
 * Ordena o resultado do filtro geral. Item sem valor no critério vai sempre
 * para o fim, nos dois sentidos; empate desempata pelo nome. Critério que
 * não existe mais (campo de categoria desmarcada) cai em "mais recentes".
 */
export function sortGlobalViews(
  views: EntryView[],
  sortBy: string,
  sortDir: SortDir,
  unifiedFields: UnifiedField[]
): EntryView[] {
  const byName = (a: EntryView, b: EntryView) => a.name.localeCompare(b.name, "pt-BR")

  let valueOf: (view: EntryView) => SortValue = (view) => view.createdAt
  let dir = sortDir
  if (sortBy === "rating") {
    valueOf = (view) => view.rating
  } else if (sortBy === "name") {
    valueOf = (view) => view.name
  } else if (sortBy.startsWith(FIELD_SORT_PREFIX)) {
    const key = sortBy.slice(FIELD_SORT_PREFIX.length)
    const field = unifiedFields.find((item) => item.key === key)
    if (field) valueOf = (view) => fieldValueOf(view, field)
    else dir = "desc"
  }

  const sign = dir === "asc" ? 1 : -1
  return [...views].sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)
    if (va === null && vb === null) return byName(a, b)
    if (va === null) return 1
    if (vb === null) return -1
    const diff =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base", numeric: true })
    return diff !== 0 ? diff * sign : byName(a, b)
  })
}

export interface GroupedResult {
  categoryId: string
  categoryName: string
  icon: string | null
  views: EntryView[]
}

/** Agrupa o resultado do filtro geral por categoria, preservando a ordem. */
export function groupByCategory(views: EntryView[], categories: Category[]): GroupedResult[] {
  const order = new Map(categories.map((category, index) => [category.id, index]))
  const groups = new Map<string, GroupedResult>()

  for (const view of views) {
    const group = groups.get(view.categoryId)
    if (group) {
      group.views.push(view)
    } else {
      const category = categories.find((item) => item.id === view.categoryId)
      groups.set(view.categoryId, {
        categoryId: view.categoryId,
        categoryName: view.categoryName,
        icon: category?.icon ?? null,
        views: [view],
      })
    }
  }

  return [...groups.values()].sort(
    (a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0)
  )
}
