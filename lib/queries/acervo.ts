import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, EntryWithTags, Tag } from "@/lib/domain/types"
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

  const [categoriesResult, tagsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*, entries(*, entry_tags(tag_id))")
      .eq("owner_id", ownerId)
      .order("display_order", { ascending: true }),
    supabase.from("tags").select("id, name, color"),
  ])

  const rows = (categoriesResult.data ?? []) as (Omit<Category, "estrutura"> & {
    estrutura: unknown
    entries: EntryWithTags[]
  })[]

  const categories: Category[] = []
  const entriesByCategory = new Map<string, EntryWithTags[]>()

  for (const row of rows) {
    const { entries, ...category } = row
    categories.push({ ...category, estrutura: parseEstrutura(row.estrutura) })
    entriesByCategory.set(category.id, entries ?? [])
  }

  return {
    categories,
    entriesByCategory,
    tags: ((tagsResult.data ?? []) as Tag[]).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    ),
  }
}
