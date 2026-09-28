import { cache } from "react"

import { parseEstrutura } from "@/lib/domain/fields"
import type { TreeFolder } from "@/lib/domain/collections"
import type { Category, EntryFolder, EntryWithTags, Profile, Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface CategoryPageData {
  category: Category | null
  owner: Profile | null
  /** As outras categorias do mesmo dono, para a fileira de abas. */
  siblings: Pick<Category, "id" | "name" | "icon" | "display_order">[]
  entries: EntryWithTags[]
  tags: Tag[]
  /** As subpastas desta categoria. */
  entryFolders: EntryFolder[]
  /** As pastas das Coleções do dono — a trilha "Coleções › Bebidas › Suco". */
  collectionFolders: TreeFolder[]
}

/**
 * Tudo da página de categoria em UMA consulta, usando o embedding do PostgREST:
 * a categoria traz o dono, e o dono traz as categorias irmãs e as pastas das
 * Coleções; a categoria traz as subpastas e os itens, e cada item traz os
 * vínculos de tag. As tags do grupo vão em paralelo, porque não dependem de
 * nada disso.
 */
export const getCategoryPage = cache(async (categoryId: string): Promise<CategoryPageData> => {
  const supabase = await createClient()

  const [categoryResult, tagsResult] = await Promise.all([
    supabase
      .from("categories")
      .select(
        `*,
         owner:profiles(id, username, display_name, avatar_url, created_at,
                        categories(id, name, icon, display_order),
                        folders(id, name, parent_folder_id, display_order)),
         entry_folders(*),
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
        owner: (Profile & { categories: Category[]; folders: TreeFolder[] }) | null
        entry_folders: EntryFolder[]
        entries: EntryWithTags[]
      })
    | null

  if (!row) {
    return {
      category: null,
      owner: null,
      siblings: [],
      entries: [],
      tags,
      entryFolders: [],
      collectionFolders: [],
    }
  }

  const { owner, entries, entry_folders: entryFolders, ...category } = row
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
    entryFolders: entryFolders ?? [],
    collectionFolders: owner?.folders ?? [],
  }
})
