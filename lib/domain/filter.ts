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
}

export const EMPTY_CATEGORY_FILTER: CategoryFilter = {
  query: "",
  minRating: "",
  maxRating: "",
  tagIds: [],
  sort: "recent",
}

/** Ordenação não conta como filtro: ela não esconde item nenhum. */
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

    if (tagIds.length > 0) {
      // OR entre as tags marcadas.
      const hit = view.tags.some((tag) => tagIds.includes(tag.id))
      if (!hit) return false
    }

    return true
  })

  return sortViews(filtered, filter.sort)
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

export interface GlobalFilter {
  query: string
  minRating: string
  maxRating: string
  tagIds: string[]
  /** chave do campo unificado → filtro */
  fields: Record<string, FieldFilter>
}

export const EMPTY_GLOBAL_FILTER: GlobalFilter = {
  query: "",
  minRating: "",
  maxRating: "",
  tagIds: [],
  fields: {},
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
    Object.values(filter.fields).some(isFieldFilterActive)
  )
}

/**
 * Um campo ativo no filtro é uma regra dura: item que não tem esse campo, ou
 * está com ele vazio, fica de fora. Filtros ativos são combinados com AND.
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

  return views.filter((view) => {
    if (filter.query.trim()) {
      // No filtro geral a busca livre é pelo NOME do item.
      const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
      const name = view.name.toLowerCase()
      if (!terms.every((term) => name.includes(term))) return false
    }

    if (min !== null && (view.rating === null || view.rating < min)) return false
    if (max !== null && (view.rating === null || view.rating > max)) return false

    if (filter.tagIds.length > 0) {
      if (!view.tags.some((tag) => filter.tagIds.includes(tag.id))) return false
    }

    for (const field of activeFields) {
      const current = filter.fields[field.key]
      if (!current) continue
      if (!matchesField(view, field, current)) return false
    }

    return true
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
