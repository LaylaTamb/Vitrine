import { parseEstrutura } from "@/lib/domain/fields"
import type { FavoriteRow } from "@/lib/domain/favorites"
import type { Category, EntryWithTags, Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface FavoritesPageData {
  /** `false` = a migração 20 ainda não rodou (a tabela não existe). */
  ready: boolean
  rows: FavoriteRow[]
  /** Os itens favoritos (de todas as categorias), com os vínculos de tag. */
  entries: EntryWithTags[]
  /** Todas as categorias da pessoa — o "Editar aba" escolhe entre elas. */
  categories: Category[]
  tags: Tag[]
}

type CategoryRow = Omit<Category, "estrutura"> & { estrutura: unknown }

/**
 * A aba Favoritos em UMA ida ao banco: as linhas de favoritos já trazem o
 * item por embedding; as categorias e as tags vão em paralelo.
 */
export async function getFavoritesPage(ownerId: string): Promise<FavoritesPageData> {
  const supabase = await createClient()

  const [favoritesResult, categoriesResult, tagsResult] = await Promise.all([
    supabase
      .from("category_favorites")
      .select("category_id, owner_id, entry_id, tab_position, entry:entries(*, entry_tags(tag_id))")
      .eq("owner_id", ownerId),
    supabase
      .from("categories")
      .select("*")
      .eq("owner_id", ownerId)
      .order("display_order", { ascending: true }),
    supabase.from("tags").select("id, name, color"),
  ])

  const categories = ((categoriesResult.data ?? []) as CategoryRow[])
    .map((row) => ({ ...row, estrutura: parseEstrutura(row.estrutura) }))
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"))
  const tags = ((tagsResult.data ?? []) as Tag[]).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  )

  if (favoritesResult.error) {
    return { ready: false, rows: [], entries: [], categories, tags }
  }

  // O PostgREST devolve o item embutido como objeto (a FK é de um para um).
  const raw = (favoritesResult.data ?? []) as unknown as (FavoriteRow & {
    entry: EntryWithTags | null
  })[]
  return {
    ready: true,
    rows: raw.map((row) => ({
      category_id: row.category_id,
      owner_id: row.owner_id,
      entry_id: row.entry_id,
      tab_position: row.tab_position,
    })),
    entries: raw.map((row) => row.entry).filter((entry): entry is EntryWithTags => entry !== null),
    categories,
    tags,
  }
}
