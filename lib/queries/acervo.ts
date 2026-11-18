import { parseEstrutura } from "@/lib/domain/fields"
import { mergeTagsByName } from "@/lib/domain/tags"
import type { Category, EntryWithTags, Tag } from "@/lib/domain/types"
import { getOwnerTags } from "@/lib/queries/tags"
import { createClient } from "@/lib/supabase/server"

export interface AcervoData {
  categories: Category[]
  /** Os itens de cada categoria, na ordem em que vieram. */
  entriesByCategory: Map<string, EntryWithTags[]>
  tags: Tag[]
}

/**
 * O acervo inteiro de uma pessoa: todas as categorias com todos os itens, em
 * uma consulta só (embedding), mais as tags em paralelo. É o que o filtro
 * geral cruza — e o cruzamento é todo em memória.
 */
export async function getAcervo(ownerId: string): Promise<AcervoData> {
  const supabase = await createClient()

  const [categoriesResult, ownerTags] = await Promise.all([
    supabase
      .from("categories")
      .select("*, entries(*, entry_tags(tag_id))")
      .eq("owner_id", ownerId)
      .order("display_order", { ascending: true }),
    getOwnerTags(supabase, ownerId),
  ])

  const rows = (categoriesResult.data ?? []) as (Omit<Category, "estrutura"> & {
    estrutura: unknown
    entries: EntryWithTags[]
  })[]

  const categories: Category[] = []
  const entriesByCategory = new Map<string, EntryWithTags[]>()

  // Cada categoria tem as suas tags (migração 49); aqui, que cruza todas, as de
  // mesmo nome viram uma só — e os vínculos dos itens apontam para ela.
  const { tags, canonical } = mergeTagsByName(ownerTags)

  for (const row of rows) {
    // As cópias antigas de match ficam de fora: o match mora na aba Match.
    if (row.kind === "match") continue
    const { entries, ...category } = row
    categories.push({ ...category, estrutura: parseEstrutura(row.estrutura) })
    entriesByCategory.set(
      category.id,
      (entries ?? []).map((entry) => ({
        ...entry,
        entry_tags: [
          ...new Set(
            (entry.entry_tags ?? []).map((link) => canonical.get(link.tag_id) ?? link.tag_id)
          ),
        ].map((tagId) => ({ tag_id: tagId })),
      }))
    )
  }

  return {
    categories,
    entriesByCategory,
    tags,
  }
}
