import { tabOrder } from "@/lib/domain/favorites"
import type { Category, Folder } from "@/lib/domain/types"
import { getCollections } from "@/lib/queries/collections"
import { createClient } from "@/lib/supabase/server"

export interface FavoritesPageData {
  /** `false` = a migração 20 ainda não rodou (a tabela não existe). */
  ready: boolean
  /** Os ids das categorias favoritas, na ordem. */
  order: string[]
  /** Todas as categorias da pessoa — a tela mostra só as favoritas. */
  categories: Category[]
  /** As pastas — para dizer onde cada favorita mora. */
  folders: Folder[]
  /** category_id → total de itens. */
  counts: Record<string, number>
}

/** As favoritas da pessoa, na ordem. `null` = a migração 20 ainda não rodou. */
export async function getMyFavoriteIds(ownerId: string): Promise<string[] | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("category_favorites")
    .select("category_id, tab_position")
    .eq("owner_id", ownerId)
    .not("tab_position", "is", null)
  if (error) return null
  return tabOrder((data ?? []) as { category_id: string; tab_position: number | null }[])
}

/**
 * A tela das favoritas: as categorias da pessoa (com as contagens, como nas
 * Coleções) e, em paralelo, a ordem das favoritas em `category_favorites`.
 */
export async function getFavoritesPage(ownerId: string): Promise<FavoritesPageData> {
  const [collections, order] = await Promise.all([
    getCollections(ownerId),
    getMyFavoriteIds(ownerId),
  ])

  const { categories, folders, counts } = collections
  return { ready: order !== null, order: order ?? [], categories, folders, counts }
}
