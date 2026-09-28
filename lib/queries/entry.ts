import { cache } from "react"

import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, EntryFolder, EntryWithTags, Profile, Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface EntryPageData {
  entry: EntryWithTags | null
  category: Category | null
  owner: Profile | null
  tags: Tag[]
  /** As subpastas da categoria do item — o "Pasta" do formulário e o Voltar. */
  entryFolders: EntryFolder[]
}

/**
 * A plaqueta de um item: o item traz a categoria por embedding, e a categoria
 * traz o dono. As tags do grupo vão em paralelo.
 */
export const getEntryPage = cache(async (entryId: string): Promise<EntryPageData> => {
  const supabase = await createClient()

  const [entryResult, tagsResult] = await Promise.all([
    supabase
      .from("entries")
      .select(
        `*, entry_tags(tag_id),
         category:categories(*, entry_folders(*),
                             owner:profiles(id, username, display_name, avatar_url, created_at))`
      )
      .eq("id", entryId)
      .maybeSingle(),
    supabase.from("tags").select("id, name, color"),
  ])

  const tags = ((tagsResult.data ?? []) as Tag[]).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  )

  const row = entryResult.data as
    | (EntryWithTags & {
        category:
          | (Omit<Category, "estrutura"> & {
              estrutura: unknown
              owner: Profile | null
              entry_folders: EntryFolder[]
            })
          | null
      })
    | null

  if (!row) return { entry: null, category: null, owner: null, tags, entryFolders: [] }

  const { category: categoryRow, ...entry } = row
  const owner = categoryRow?.owner ?? null
  const entryFolders = categoryRow?.entry_folders ?? []

  let category: Category | null = null
  if (categoryRow) {
    // Tira o que veio embutido: `Category` é só a linha da categoria.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { owner: _owner, entry_folders: _folders, ...rest } = categoryRow
    category = { ...rest, estrutura: parseEstrutura(rest.estrutura) }
  }

  return {
    entry: entry as EntryWithTags,
    category,
    owner,
    tags,
    entryFolders,
  }
})
