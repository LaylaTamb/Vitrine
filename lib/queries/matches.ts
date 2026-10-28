import { parseBlendPool, type BlendPool } from "@/lib/domain/blend"
import { isMissingSchema } from "@/lib/domain/errors"
import { parseMatches, type MatchView } from "@/lib/domain/match"
import type { ListProfile } from "@/lib/queries/social"
import { getMyFollows } from "@/lib/queries/social"
import { createClient } from "@/lib/supabase/server"

/** As colunas que a tela dos matches lê (as pessoas vêm com o perfil). */
export const MATCH_SELECT =
  "id, status, created_at, created_by, match_members(user_id, status, color, position, profile:profiles(username, display_name, avatar_url))"

/**
 * Os matches de quem está logado (a RLS só devolve os seus), do mais novo
 * para o mais velho, sem os que a pessoa excluiu da lista (`hidden_at`,
 * migração 34). `ready = false`: a migração 30 ainda não rodou.
 */
export async function getMyMatches(
  userId: string
): Promise<{ ready: boolean; matches: MatchView[] }> {
  const supabase = await createClient()
  const [matchesResult, hiddenResult] = await Promise.all([
    supabase.from("matches").select(MATCH_SELECT).order("created_at", { ascending: false }).limit(50),
    // Antes da migração 34 a coluna não existe: nada escondido.
    supabase
      .from("match_members")
      .select("match_id")
      .eq("user_id", userId)
      .not("hidden_at", "is", null),
  ])
  const { data, error } = matchesResult
  if (error) return { ready: !isMissingSchema(error), matches: [] }
  const hidden = new Set(
    hiddenResult.error
      ? []
      : ((hiddenResult.data ?? []) as { match_id: string }[]).map((row) => row.match_id)
  )
  return { ready: true, matches: parseMatches(data).filter((match) => !hidden.has(match.id)) }
}

/** Um match (só quem está nele lê — a RLS). `null`: não existe ou não é seu. */
export async function getMatchById(matchId: string): Promise<MatchView | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle()
  if (error || !data) return null
  return parseMatches([data])[0] ?? null
}

/** Os amigos (os dois se seguem) — os que podem ser chamados para um match. */
export async function getMyFriends(userId: string): Promise<ListProfile[]> {
  const { following, followers } = await getMyFollows(userId)
  const ids = [...following].filter((id) => followers.has(id))
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids)
  return ((data ?? []) as ListProfile[]).sort((a, b) =>
    (a.display_name || a.username).localeCompare(b.display_name || b.username, "pt-BR")
  )
}

/**
 * A base da lista do match (migração 45): só o que todos do match podem ver.
 * `ready = false`: a migração ainda não rodou. `pool = null`: o match não é
 * seu ou não está pronto.
 */
export async function getMatchBlendPool(
  matchId: string
): Promise<{ ready: boolean; pool: BlendPool | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("match_blend_pool", { p_match_id: matchId })
  if (error) return { ready: !isMissingSchema(error), pool: null }
  return { ready: true, pool: parseBlendPool(data) }
}

/** Os itens da lista que quem está logado já trouxe para a A organizar ("trazer" + o original). */
export async function getBroughtIds(userId: string, entryIds: string[]): Promise<string[]> {
  if (entryIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("entries")
    .select("source_id")
    .eq("owner_id", userId)
    .eq("source", "trazer")
    .in("source_id", entryIds)
  if (error) return []
  return ((data ?? []) as { source_id: string }[]).map((row) => row.source_id)
}
