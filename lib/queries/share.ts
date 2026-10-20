import { parseEstrutura } from "@/lib/domain/fields"
import { recentCategoryIds, suggestCategoryId } from "@/lib/domain/share"
import type { Category } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface ShareData {
  /** Todas as categorias da pessoa, já na ordem do painel: recentes primeiro, depois por nome. */
  categories: Category[]
  /** O palpite de onde o texto vai (`suggestCategoryId`). */
  suggestedId: string | null
}

type CategoryRow = Omit<Category, "estrutura"> & { estrutura: unknown }

/** Quantos itens recentes bastam para ordenar e adivinhar — sem puxar o acervo inteiro. */
const RECENT_LIMIT = 1000

/**
 * O painel do acesso rápido em UMA ida ao banco: as categorias e os itens
 * mais recentes (só nome, categoria e data) vão juntos.
 */
export async function getShareData(ownerId: string, sharedText: string): Promise<ShareData> {
  const supabase = await createClient()
  const [categoriesResult, entriesResult] = await Promise.all([
    supabase.from("categories").select("*").eq("owner_id", ownerId),
    supabase
      .from("entries")
      .select("name, category_id, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ])

  const all = ((categoriesResult.data ?? []) as CategoryRow[]).map((row) => ({
    ...row,
    estrutura: parseEstrutura(row.estrutura),
  }))
  const entries = (entriesResult.data ?? []) as {
    name: string
    category_id: string
    created_at: string
  }[]

  const recent = recentCategoryIds(entries)
  const rank = new Map(recent.map((id, index) => [id, index]))
  const categories = all.sort(
    (a, b) =>
      (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
      a.name.localeCompare(b.name, "pt-BR")
  )

  return { categories, suggestedId: suggestCategoryId(sharedText, all, entries) }
}
