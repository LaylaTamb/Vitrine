/**
 * Favoritos (migração 20), duas coisas independentes:
 *   - a **estrelinha** de um item: o favorito da categoria (no máximo um, só
 *     o dono vê). É só uma marca no item — não leva nada para a aba;
 *   - a **aba Favoritos**: as categorias que a pessoa escolheu ("Adicionar
 *     categoria"), inteiras, na ordem dela — como nas Coleções.
 */

/** Uma linha de `category_favorites`. */
export interface FavoriteRow {
  category_id: string
  owner_id: string
  /** O favorito da categoria (a estrelinha). `null` = nenhum. */
  entry_id: string | null
  /** A posição na aba Favoritos. `null` = fora da aba. */
  tab_position: number | null
}

/** Tocar a estrela: marca; marcar outro troca; tocar de novo desmarca. */
export function nextFavorite(current: string | null, entryId: string): string | null {
  return current === entryId ? null : entryId
}

/** As categorias da aba, na ordem (ids). */
export function tabOrder(rows: Pick<FavoriteRow, "category_id" | "tab_position">[]): string[] {
  return rows
    .filter((row) => row.tab_position !== null)
    .sort((a, b) => (a.tab_position ?? 0) - (b.tab_position ?? 0))
    .map((row) => row.category_id)
}

/** As categorias da aba, na ordem dada; as que não existem mais ficam de fora. */
export function tabCategories<T extends { id: string }>(order: string[], categories: T[]): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return order.flatMap((id) => {
    const category = byId.get(id)
    return category ? [category] : []
  })
}

/** O que dá para pôr na aba: as categorias que ainda não estão nela (sem a "A organizar"). */
export function addableCategories<T extends { id: string; kind?: string | null }>(
  order: string[],
  categories: T[]
): T[] {
  const inTab = new Set(order)
  return categories.filter((category) => !inTab.has(category.id) && category.kind !== "inbox")
}
