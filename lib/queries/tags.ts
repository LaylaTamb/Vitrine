import type { SupabaseClient } from "@supabase/supabase-js"

import { isMissingColumn } from "@/lib/domain/errors"
import type { Tag } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface TagWithUsage extends Tag {
  usage: number
  /** A categoria da tag (migração 49). `null` antes dele: a tag ainda é do grupo todo. */
  categoryId: string | null
}

function sortTags<T extends Tag>(tags: T[]): T[] {
  return tags.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

/**
 * As tags de uma coluna (`category_id` ou `owner_id`, migração 49). Antes do
 * 49 a coluna não existe e a tag ainda é do grupo todo: vêm todas.
 */
async function tagsWhere(
  supabase: SupabaseClient,
  column: "category_id" | "owner_id",
  value: string
): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("id, name, color").eq(column, value)
  if (error && isMissingColumn(error, column)) {
    const all = await supabase.from("tags").select("id, name, color")
    return sortTags((all.data ?? []) as Tag[])
  }
  return sortTags((data ?? []) as Tag[])
}

/** As tags de uma categoria — as únicas que os itens dela usam. */
export function getCategoryTags(supabase: SupabaseClient, categoryId: string): Promise<Tag[]> {
  return tagsWhere(supabase, "category_id", categoryId)
}

/** Todas as tags de uma pessoa, de todas as categorias dela (o filtro geral e o backup). */
export function getOwnerTags(supabase: SupabaseClient, ownerId: string): Promise<Tag[]> {
  return tagsWhere(supabase, "owner_id", ownerId)
}

/**
 * As tags da pessoa, cada uma com a categoria e a contagem de uso (vinda da
 * view — nenhuma linha é puxada). As Configurações agrupam por categoria.
 */
export async function getTagsWithUsage(ownerId: string): Promise<TagWithUsage[]> {
  const supabase = await createClient()

  const [owned, usageResult] = await Promise.all([
    supabase.from("tags").select("id, name, color, category_id").eq("owner_id", ownerId),
    supabase.from("tag_usage_counts").select("tag_id, total"),
  ])
  const rows: (Tag & { category_id?: string })[] =
    owned.error && isMissingColumn(owned.error)
      ? (((await supabase.from("tags").select("id, name, color")).data ?? []) as Tag[])
      : ((owned.data ?? []) as (Tag & { category_id: string })[])

  const usage = new Map(
    ((usageResult.data ?? []) as { tag_id: string; total: number }[]).map((row) => [
      row.tag_id,
      row.total,
    ])
  )

  return sortTags(
    rows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      usage: usage.get(tag.id) ?? 0,
      categoryId: tag.category_id ?? null,
    }))
  )
}
