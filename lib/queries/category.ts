import { cache } from "react"

import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, EntryWithTags, Profile, Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface CategoryPageData {
  category: Category | null
  owner: Profile | null
  /** As outras categorias do mesmo dono, para a fileira de abas. */
  siblings: Pick<Category, "id" | "name" | "icon" | "display_order">[]
  entries: EntryWithTags[]
  tags: Tag[]
}

/**
 * Tudo da página de categoria em UMA consulta, usando o embedding do PostgREST:
 * a categoria traz o dono, e o dono traz as categorias irmãs; a categoria traz
 * os itens, e cada item traz os vínculos de tag. As tags do grupo vão em
 * paralelo, porque não dependem de nada disso.
 */
export const getCategoryPage = cache(async (categoryId: string): Promise<CategoryPageData> => {
  const supabase = await createClient()

  const [categoryResult, tagsResult] = await Promise.all([
    supabase
      .from("categories")
      .select(
        `*,
         owner:profiles(id, username, display_name, avatar_url, created_at,
                        categories(id, name, icon, display_order)),
         entries(*, entry_tags(tag_id))`
      )
      .eq("id", categoryId)
      .order("created_at", { referencedTable: "entries", ascending: false })
      .maybeSingle(),
    supabase.from("tags").select("id, name, color").order("name", { ascending: true }),
  ])

  const tags = ((tagsResult.data ?? []) as Tag[]).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  )

  const row = categoryResult.data as
    | (Omit<Category, "estrutura"> & {
        estrutura: unknown
        owner: (Profile & { categories: Category[] }) | null
        entries: EntryWithTags[]
      })
    | null

  if (!row) {
    return { category: null, owner: null, siblings: [], entries: [], tags }
  }

  const { owner, entries, ...category } = row
  const siblings = (owner?.categories ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"))

  const ownerProfile: Profile | null = owner
    ? {
        id: owner.id,
        username: owner.username,
        display_name: owner.display_name,
        avatar_url: owner.avatar_url,
        created_at: owner.created_at,
      }
    : null

  return {
    category: { ...category, estrutura: parseEstrutura(row.estrutura) },
    owner: ownerProfile,
    siblings,
    entries: entries ?? [],
    tags,
  }
})
