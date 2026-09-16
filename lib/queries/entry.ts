import { cache } from "react"

import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, EntryWithTags, Profile, Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface EntryPageData {
  entry: EntryWithTags | null
  category: Category | null
  owner: Profile | null
  tags: Tag[]
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
         category:categories(*, owner:profiles(id, username, display_name, avatar_url, created_at))`
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
          | (Omit<Category, "estrutura"> & { estrutura: unknown; owner: Profile | null })
          | null
      })
    | null

  if (!row) return { entry: null, category: null, owner: null, tags }

  const { category, ...entry } = row
  const owner = category?.owner ?? null

  return {
    entry: entry as EntryWithTags,
    category: category
      ? { ...category, estrutura: parseEstrutura(category.estrutura) }
      : null,
    owner,
    tags,
  }
})
