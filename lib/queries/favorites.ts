import { tabOrder } from "@/lib/domain/favorites"
import type { Category } from "@/lib/domain/types"
import { getCollections } from "@/lib/queries/collections"
import { createClient } from "@/lib/supabase/server"

export interface FavoritesPageData {
  /** `false` = a migração 20 ainda não rodou (a tabela não existe). */
  ready: boolean
  /** Os ids das categorias da aba, na ordem. */
  order: string[]
  /** Todas as categorias da pessoa — a aba mostra as escolhidas, o "Adicionar" as outras. */
  categories: Category[]
  /** category_id → total de itens. */
  counts: Record<string, number>
}

/**
 * A aba Favoritos: as categorias da pessoa (com as contagens, como nas
 * Coleções) e, em paralelo, a ordem da aba em `category_favorites`.
 */
export async function getFavoritesPage(ownerId: string): Promise<FavoritesPageData> {
  const supabase = await createClient()
  const [collections, favoritesResult] = await Promise.all([
    getCollections(ownerId),
    supabase
      .from("category_favorites")
      .select("category_id, tab_position")
      .eq("owner_id", ownerId)
      .not("tab_position", "is", null),
  ])

  const { categories, counts } = collections
  if (favoritesResult.error) return { ready: false, order: [], categories, counts }

  const rows = (favoritesResult.data ?? []) as { category_id: string; tab_position: number | null }[]
  return { ready: true, order: tabOrder(rows), categories, counts }
}
