import { cache } from "react"

import { parseProfileCard, type ProfileCard } from "@/lib/domain/card"
import { toCategory } from "@/lib/queries/collections"
import type {
  Category,
  EntryFolder,
  EntryWithTags,
  Folder,
  Profile,
  Tag,
} from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

/**
 * Leitura SEM login. As tabelas não abrem para o papel `anon` (migração 14):
 * quem não tem conta lê só pelas funções `public_profile` e `public_category`,
 * que entregam um perfil ou uma categoria por vez, e só o que é público.
 *
 * Antes de a migração rodar (função ausente), tudo aqui devolve `null` — a
 * página mostra "não encontrado", como mostraria para algo privado.
 */

type CategoryRow = Omit<Category, "estrutura"> & { estrutura: unknown }

export interface PublicProfileData {
  profile: Profile
  /** O cartão de apresentação (migração 23). `null` antes dela. */
  card: ProfileCard | null
  folders: Folder[]
  categories: Category[]
  /** category_id → total de itens. */
  counts: Record<string, number>
}

export const getPublicProfile = cache(
  async (username: string): Promise<PublicProfileData | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("public_profile", { p_username: username })
    if (error || !data) return null

    const row = data as {
      profile: Profile
      card?: unknown
      folders: Folder[] | null
      categories: CategoryRow[] | null
      counts: Record<string, number> | null
    }
    return {
      profile: row.profile,
      card: parseProfileCard(row.card),
      folders: row.folders ?? [],
      categories: (row.categories ?? []).map(toCategory),
      counts: row.counts ?? {},
    }
  }
)

export interface PublicCategoryData {
  owner: Profile
  category: Category
  entryFolders: EntryFolder[]
  entries: EntryWithTags[]
  /** Só as tags que os itens desta categoria usam. */
  tags: Tag[]
}

export const getPublicCategory = cache(
  async (categoryId: string): Promise<PublicCategoryData | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("public_category", { p_category_id: categoryId })
    // id que nem é uuid também cai aqui (o banco recusa): "não encontrada".
    if (error || !data) return null

    const row = data as {
      owner: Profile
      category: CategoryRow
      entry_folders: EntryFolder[] | null
      entries: EntryWithTags[] | null
      tags: Tag[] | null
    }
    return {
      owner: row.owner,
      category: toCategory(row.category),
      entryFolders: row.entry_folders ?? [],
      entries: row.entries ?? [],
      tags: (row.tags ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }
  }
)

/**
 * O cartão de apresentação de um perfil (migração 23) — público, com ou sem
 * login: só categorias públicas de fato. `null` = sem perfil, ou antes da
 * migração.
 */
export const getProfileCard = cache(async (username: string): Promise<ProfileCard | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("profile_card", { p_username: username })
  if (error || !data) return null
  return parseProfileCard(data)
})

/**
 * O @ atual de quem largou `username` nos últimos 14 dias (migração 15) —
 * para `/v/<@ antigo>` levar ao perfil certo. `null` = ninguém.
 */
export async function resolveUsername(username: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("resolve_username", { p_username: username })
  if (error || typeof data !== "string" || !data) return null
  return data
}
