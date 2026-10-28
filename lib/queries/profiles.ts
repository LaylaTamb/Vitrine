import { coversByCategory, withoutMatchCopies } from "@/lib/domain/collections"
import { parseEstrutura } from "@/lib/domain/fields"
import type { Category, Folder, Profile } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
  return ((data ?? []) as Profile[]).sort((a, b) =>
    (a.display_name || a.username).localeCompare(b.display_name || b.username, "pt-BR")
  )
}

/** Só a linha do perfil (sem acervo), pelo @ — para as listas de seguidores. */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("username", username)
    .maybeSingle()
  return (data as Profile | null) ?? null
}

export interface PublicCollections {
  profile: Profile | null
  folders: Folder[]
  categories: Category[]
  counts: Record<string, number>
  /** category_id → até 3 fotos da capa, só do que a pessoa logada pode ver (migração 40). */
  covers: Record<string, string[]>
}

/**
 * O acervo de outra pessoa, a partir do username.
 *
 * Duas idas ao banco no total: a primeira resolve o perfil e já traz pastas e
 * categorias por embedding; a segunda (em paralelo com nada) pega as contagens
 * da view, que precisam do owner_id.
 */
export async function getCollectionsByUsername(username: string): Promise<PublicCollections> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select(
      `id, username, display_name, avatar_url, created_at,
       folders(*),
       categories(*)`
    )
    .eq("username", username)
    .maybeSingle()

  const row = data as
    | (Profile & { folders: Folder[]; categories: (Omit<Category, "estrutura"> & { estrutura: unknown })[] })
    | null

  if (!row) {
    return { profile: null, folders: [], categories: [], counts: {}, covers: {} }
  }

  const { folders: allFolders, categories: allCategories, ...profile } = row
  const { folders, categories } = withoutMatchCopies(allFolders ?? [], allCategories ?? [])

  const [{ data: countRows }, coversResult] = await Promise.all([
    supabase.from("category_entry_counts").select("category_id, total").eq("owner_id", profile.id),
    supabase
      .from("category_covers")
      .select("category_id, image_url, position")
      .eq("owner_id", profile.id),
  ])

  const counts: Record<string, number> = {}
  for (const countRow of (countRows ?? []) as { category_id: string; total: number }[]) {
    counts[countRow.category_id] = countRow.total
  }

  return {
    profile,
    folders: folders.sort((a, b) => a.display_order - b.display_order),
    categories: categories
      .map((category) => ({ ...category, estrutura: parseEstrutura(category.estrutura) }))
      .sort((a, b) => a.display_order - b.display_order),
    counts,
    covers: coversResult.error ? {} : coversByCategory(coversResult.data ?? []),
  }
}
