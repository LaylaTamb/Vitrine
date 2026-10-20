/**
 * Favoritos (migração 20): o favorito de cada categoria (no máximo um, só o
 * dono vê) e a aba Favoritos, que a pessoa monta à parte — marcar a estrela
 * não põe a categoria na aba. Categoria sem favorito não aparece na aba
 * (só no modo "Editar aba").
 */

/** Uma linha de `category_favorites`. */
export interface FavoriteRow {
  category_id: string
  owner_id: string
  /** O favorito da categoria. `null` = nenhum. */
  entry_id: string | null
  /** A posição na aba Favoritos. `null` = fora da aba. */
  tab_position: number | null
}

/** O favorito de uma categoria. */
export function favoriteOf(rows: FavoriteRow[], categoryId: string): string | null {
  return rows.find((row) => row.category_id === categoryId)?.entry_id ?? null
}

/** Tocar a estrela: marca; marcar outro troca; tocar de novo desmarca. */
export function nextFavorite(current: string | null, entryId: string): string | null {
  return current === entryId ? null : entryId
}

/** Grava o favorito de uma categoria (a posição na aba fica como está). */
export function withFavorite(
  rows: FavoriteRow[],
  ownerId: string,
  categoryId: string,
  entryId: string | null
): FavoriteRow[] {
  const existing = rows.find((row) => row.category_id === categoryId)
  if (!existing) {
    if (!entryId) return rows
    return [
      ...rows,
      { category_id: categoryId, owner_id: ownerId, entry_id: entryId, tab_position: null },
    ]
  }
  return rows.map((row) => (row === existing ? { ...row, entry_id: entryId } : row))
}

/** A aba Favoritos na ordem dada; quem saiu da lista sai da aba (o favorito continua). */
export function withTab(
  rows: FavoriteRow[],
  ownerId: string,
  categoryIds: string[]
): FavoriteRow[] {
  const position = new Map(categoryIds.map((id, index) => [id, index]))
  const updated = rows.map((row) => ({
    ...row,
    tab_position: position.get(row.category_id) ?? null,
  }))
  const known = new Set(rows.map((row) => row.category_id))
  const added = categoryIds
    .filter((id) => !known.has(id))
    .map((id) => ({
      category_id: id,
      owner_id: ownerId,
      entry_id: null,
      tab_position: position.get(id) ?? null,
    }))
  return [...updated, ...added]
}

/** As categorias da aba, na ordem — inclusive as sem favorito (o modo "Editar aba"). */
export function tabOrder(rows: FavoriteRow[]): string[] {
  return rows
    .filter((row) => row.tab_position !== null)
    .sort((a, b) => (a.tab_position ?? 0) - (b.tab_position ?? 0))
    .map((row) => row.category_id)
}

/**
 * O que a aba mostra: o favorito de cada categoria da aba, na ordem; sem
 * favorito, a categoria some.
 */
export function favoritesTabItems<
  C extends { id: string },
  E extends { id: string; category_id: string },
>(rows: FavoriteRow[], categories: C[], entries: E[]): { category: C; entry: E }[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const byCategory = new Map(rows.map((row) => [row.category_id, row]))
  return tabOrder(rows).flatMap((categoryId) => {
    const category = categoryById.get(categoryId)
    const entryId = byCategory.get(categoryId)?.entry_id
    const entry = entryId ? entryById.get(entryId) : undefined
    return category && entry && entry.category_id === categoryId ? [{ category, entry }] : []
  })
}

/**
 * As mesmas regras do banco, para a demonstração: linha de categoria que não
 * existe mais sai; favorito que não é (mais) item da categoria vira `null`.
 */
export function pruneFavorites(
  rows: FavoriteRow[],
  categories: { id: string }[],
  entries: { id: string; category_id: string }[]
): FavoriteRow[] {
  const categoryIds = new Set(categories.map((category) => category.id))
  const entryCategory = new Map(entries.map((entry) => [entry.id, entry.category_id]))
  return rows
    .filter((row) => categoryIds.has(row.category_id))
    .map((row) =>
      row.entry_id && entryCategory.get(row.entry_id) !== row.category_id
        ? { ...row, entry_id: null }
        : row
    )
}
