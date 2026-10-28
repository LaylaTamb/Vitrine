import { cache } from "react"

import { withoutMatchCopies } from "@/lib/domain/collections"
import { parseEstrutura } from "@/lib/domain/fields"
import type {
  Category,
  CategorySummary,
  EntryFolder,
  EntryWithTags,
  Folder,
  Profile,
  Tag,
} from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

export interface CategoryPageData {
  category: Category | null
  owner: Profile | null
  /** As outras categorias do mesmo dono, para a fileira de abas. */
  siblings: CategorySummary[]
  entries: EntryWithTags[]
  tags: Tag[]
  /** As subpastas desta categoria. */
  entryFolders: EntryFolder[]
  /** As pastas das Coleções do dono — a trilha "Coleções › Bebidas › Suco". */
  collectionFolders: Folder[]
  /** A categoria tem a estrela? Só o dono recebe (a RLS esconde de todo o resto). */
  isFavorite: boolean
}

/**
 * Tudo da página de categoria em UMA consulta, usando o embedding do PostgREST:
 * a categoria traz o dono, e o dono traz as categorias irmãs e as pastas das
 * Coleções; a categoria traz as subpastas e os itens, e cada item traz os
 * vínculos de tag. As tags do grupo vão em paralelo, porque não dependem de
 * nada disso.
 */
export async function loadCategoryPage(categoryId: string): Promise<CategoryPageData> {
  const supabase = await createClient()

  const [categoryResult, tagsResult, favoriteResult] = await Promise.all([
    supabase
      .from("categories")
      .select(
        `*,
         owner:profiles(id, username, display_name, avatar_url, created_at,
                        categories(id, name, icon, display_order, estrutura, rating_enabled, folder_id, kind),
                        folders(*)),
         entry_folders(*),
         entries(*, entry_tags(tag_id))`
      )
      .eq("id", categoryId)
      .order("created_at", { referencedTable: "entries", ascending: false })
      .maybeSingle(),
    supabase.from("tags").select("id, name, color").order("name", { ascending: true }),
    // Sem a migração 20 (tabela ausente): não é favorita.
    supabase
      .from("category_favorites")
      .select("tab_position")
      .eq("category_id", categoryId)
      .maybeSingle(),
  ])
  const isFavorite =
    !favoriteResult.error &&
    ((favoriteResult.data as { tab_position: number | null } | null)?.tab_position ?? null) !== null

  const tags = ((tagsResult.data ?? []) as Tag[]).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  )

  const row = categoryResult.data as
    | (Omit<Category, "estrutura"> & {
        estrutura: unknown
        owner: (Profile & { categories: Category[]; folders: Folder[] }) | null
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
      isFavorite: false,
    }
  }

  const { owner, entries, entry_folders: entryFolders, ...category } = row
  // As cópias antigas de match não são destino de nada: o match mora na aba Match.
  const collection = withoutMatchCopies(owner?.folders ?? [], owner?.categories ?? [])
  const siblings = collection.categories
    .map((sibling) => ({ ...sibling, estrutura: parseEstrutura(sibling.estrutura) }))
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
    collectionFolders: collection.folders,
    isFavorite,
  }
}

/**
 * A mesma leitura, uma vez por requisição (a página e o `generateMetadata`
 * dividem). Para ler de novo depois de sincronizar uma cópia ligada, use
 * `loadCategoryPage` direto.
 */
export const getCategoryPage = cache(loadCategoryPage)
