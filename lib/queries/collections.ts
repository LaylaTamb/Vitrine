import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, Folder, Profile } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface CollectionsData {
  profile: Profile | null
  folders: Folder[]
  categories: Category[]
  /** category_id → total de itens, vindo da view (sem puxar linha nenhuma). */
  counts: Record<string, number>
}

interface CategoryRow extends Omit<Category, "estrutura"> {
  estrutura: unknown
}

export function toCategory(row: CategoryRow): Category {
  return { ...row, estrutura: parseEstrutura(row.estrutura) }
}

/**
 * Tudo que a tela de Coleções precisa, em UMA ida ao banco: as quatro
 * consultas são independentes, então vão juntas em `Promise.all`.
 */
export async function getCollections(ownerId: string): Promise<CollectionsData> {
  const supabase = await createClient()

  const [profileResult, foldersResult, categoriesResult, countsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("id", ownerId)
      .maybeSingle(),
    supabase
      .from("folders")
      .select("*")
      .eq("owner_id", ownerId)
      .order("display_order", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("owner_id", ownerId)
      .order("display_order", { ascending: true }),
    supabase.from("category_entry_counts").select("category_id, total").eq("owner_id", ownerId),
  ])

  const counts: Record<string, number> = {}
  for (const row of (countsResult.data ?? []) as { category_id: string; total: number }[]) {
    counts[row.category_id] = row.total
  }

  return {
    profile: (profileResult.data as Profile | null) ?? null,
    folders: (foldersResult.data ?? []) as Folder[],
    categories: ((categoriesResult.data ?? []) as CategoryRow[]).map(toCategory),
    counts,
  }
}
