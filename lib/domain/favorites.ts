/**
 * Favoritos (migração 20): a **estrela de uma categoria**. Qualquer categoria
 * da própria pessoa (menos a "A organizar") pode ser marcada, em qualquer
 * pasta — e continua onde está. A estrela no canto das Coleções abre só as
 * marcadas, na ordem da pessoa. Só ela vê.
 *
 * Mora em `category_favorites.tab_position`: um número = favorita (e a
 * posição na tela das favoritas); `null` = não. A coluna `entry_id` (a antiga
 * estrelinha de um item) ficou no banco, mas o app não usa mais.
 */

/** Uma linha de `category_favorites` — o que o app lê dela. */
export interface FavoriteRow {
  category_id: string
  /** A posição entre as favoritas. `null` = não é favorita. */
  tab_position: number | null
}

/** As favoritas, na ordem (ids). */
export function tabOrder(rows: Pick<FavoriteRow, "category_id" | "tab_position">[]): string[] {
  return rows
    .filter((row) => row.tab_position !== null)
    .sort((a, b) => (a.tab_position ?? 0) - (b.tab_position ?? 0))
    .map((row) => row.category_id)
}

/** As favoritas, na ordem dada; as que não existem mais ficam de fora. */
export function tabCategories<T extends { id: string }>(order: string[], categories: T[]): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return order.flatMap((id) => {
    const category = byId.get(id)
    return category ? [category] : []
  })
}

/** Dá para favoritar? Toda categoria, menos a "A organizar" (ela tem lugar fixo). */
export function canFavorite(category: { kind?: string | null }): boolean {
  return category.kind !== "inbox"
}

/** Tocar a estrela: marcar põe no fim da lista; desmarcar tira. */
export function withFavorite(order: string[], categoryId: string, favorite: boolean): string[] {
  const without = order.filter((id) => id !== categoryId)
  return favorite ? [...without, categoryId] : without
}

/** A posição de quem acabou de ser marcada: depois de todas as outras. */
export function nextTabPosition(positions: (number | null)[]): number {
  const taken = positions.filter((position): position is number => position !== null)
  return taken.length === 0 ? 0 : Math.max(...taken) + 1
}
