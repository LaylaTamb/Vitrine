import { FEED_DAYS, parseFeedRows, type FeedEntry } from "@/lib/domain/feed"
import type { Category } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

/** Quantos itens o Início lê de uma vez (viram bem menos cartões). */
const FEED_LIMIT = 150

/**
 * Os itens mais novos de quem você segue, dos últimos 30 dias. Quem decide o
 * que entra é a RLS dos itens: só o que você já pode ver (público e, de
 * amigos, o de Amigos). O índice da migração 41 deixa isto rápido; sem ele,
 * funciona igual.
 */
export async function getFeed(followingIds: string[]): Promise<FeedEntry[]> {
  if (followingIds.length === 0) return []
  const supabase = await createClient()
  const since = new Date(Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, name, rating, image_url, image_display, created_at, category:categories(id, name, icon, rating_enabled), owner:profiles(id, username, display_name, avatar_url)"
    )
    .in("owner_id", followingIds)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT)
  return error ? [] : parseFeedRows(data)
}

/** As suas categorias, só o que o "Você está em…?" precisa. */
export async function getMyPlaceCategories(
  ownerId: string
): Promise<
  Pick<
    Category,
    "id" | "name" | "icon" | "estrutura" | "kind" | "rating_enabled" | "display_order"
  >[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, estrutura, kind, rating_enabled, display_order")
    .eq("owner_id", ownerId)
  return error ? [] : ((data ?? []) as Category[])
}
