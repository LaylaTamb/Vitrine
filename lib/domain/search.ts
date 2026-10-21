/**
 * Busca nas Coleções (migração 35): pastas e categorias pelo nome — a tela
 * já tem as duas listas, então procura aqui mesmo —, e os itens pelo nome,
 * pelas tags e pelos valores dos campos, no banco (`search_my_items`).
 *
 * A comparação ignora acento, maiúscula e espaço sobrando, igual ao
 * `search_text` do SQL 35: mudou um, mude o outro.
 */

import { breadcrumbOf, type TreeFolder } from "./collections"

/** Quantas letras, no mínimo, para buscar. */
export const SEARCH_MIN = 2

/** O erro de buscar itens antes de a migração 35 rodar. */
export const SEARCH_NOT_READY =
  "A busca de itens ainda não está no banco: rode supabase/35_search_collections.sql no SQL Editor do Supabase."

/** Minúsculas, sem acento e com os espaços juntos ("Café  da Manhã" → "cafe da manha"). */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** A busca está valendo? (2 letras ou mais.) */
export function isSearching(query: string): boolean {
  return normalizeSearch(query).length >= SEARCH_MIN
}

interface Named {
  id: string
  name: string
}

/**
 * Os que têm o texto no nome: primeiro os que COMEÇAM com ele, depois os que
 * o têm no meio; empate, pelo nome.
 */
export function searchByName<T extends Named>(items: T[], query: string): T[] {
  const key = normalizeSearch(query)
  if (key.length < SEARCH_MIN) return []
  return items
    .map((item) => ({ item, name: normalizeSearch(item.name) }))
    .filter(({ name }) => name.includes(key))
    .sort(
      (a, b) =>
        Number(!a.name.startsWith(key)) - Number(!b.name.startsWith(key)) ||
        a.name.localeCompare(b.name, "pt-BR")
    )
    .map(({ item }) => item)
}

/** "Coleções › Bebidas › Suco" — onde a pasta (ou a categoria) mora. */
export function pathLabel(folders: TreeFolder[], folderId: string | null): string {
  return ["Coleções", ...breadcrumbOf(folders, folderId).map((folder) => folder.name)].join(" › ")
}

/** Um item achado pelo banco. */
export interface ItemHit {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  /** A pasta das Coleções onde a categoria mora. */
  categoryFolderId: string | null
  rating: number | null
  imageUrl: string | null
  imageDisplay: unknown
  /** Por que foi achado. */
  matched: "name" | "tag" | "field"
  /** A tag, ou o valor do campo, que bateu. */
  matchValue: string | null
  /** O nome do campo que bateu. */
  matchLabel: string | null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** A resposta de `search_my_items` → a tela (o que vier torto fica de fora). */
export function parseItemHits(raw: unknown): ItemHit[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value): ItemHit[] => {
    const row = value as Record<string, unknown> | null
    const id = text(row?.id)
    const categoryId = text(row?.category_id)
    if (!id || !categoryId) return []
    const rating = Number(row?.rating)
    const matched = row?.matched === "tag" || row?.matched === "field" ? row.matched : "name"
    return [
      {
        id,
        name: typeof row?.name === "string" ? row.name : "",
        categoryId,
        categoryName: text(row?.category_name) ?? "",
        categoryIcon: text(row?.category_icon),
        categoryColor: text(row?.category_color),
        categoryFolderId: text(row?.category_folder_id),
        rating: row?.rating !== null && Number.isFinite(rating) && rating > 0 ? rating : null,
        imageUrl: text(row?.image_url),
        imageDisplay: row?.image_display ?? null,
        matched,
        matchValue: text(row?.match_value),
        matchLabel: text(row?.match_label),
      },
    ]
  })
}

/** "Bairro: Pinheiros", "tag barato" — por que o item apareceu (nada, se foi o nome). */
export function matchReason(hit: Pick<ItemHit, "matched" | "matchValue" | "matchLabel">): string {
  if (hit.matched === "tag" && hit.matchValue) return `tag ${hit.matchValue}`
  if (hit.matched === "field" && hit.matchValue) {
    const value = hit.matchValue.length > 60 ? `${hit.matchValue.slice(0, 57)}…` : hit.matchValue
    return hit.matchLabel ? `${hit.matchLabel}: ${value}` : value
  }
  return ""
}
