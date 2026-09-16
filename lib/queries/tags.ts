import type { Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface TagWithUsage extends Tag {
  usage: number
}

export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("tags").select("id, name, color")
  return ((data ?? []) as Tag[]).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

/** As tags com a contagem de uso vinda da view — nenhuma linha é puxada. */
export async function getTagsWithUsage(): Promise<TagWithUsage[]> {
  const supabase = await createClient()

  const [tagsResult, usageResult] = await Promise.all([
    supabase.from("tags").select("id, name, color"),
    supabase.from("tag_usage_counts").select("tag_id, total"),
  ])

  const usage = new Map(
    ((usageResult.data ?? []) as { tag_id: string; total: number }[]).map((row) => [
      row.tag_id,
      row.total,
    ])
  )

  return ((tagsResult.data ?? []) as Tag[])
    .map((tag) => ({ ...tag, usage: usage.get(tag.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}
