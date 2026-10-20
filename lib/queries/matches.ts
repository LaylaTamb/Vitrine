import { isMissingSchema } from "@/lib/domain/errors"
import {
  decorateMatchCopy,
  parseMatches,
  type MatchCopyRow,
  type MatchView,
} from "@/lib/domain/match"
import type { ListProfile } from "@/lib/queries/social"
import { getMyFollows } from "@/lib/queries/social"
import { createClient } from "@/lib/supabase/server"

/** As colunas que a tela dos matches lê (as pessoas vêm com o perfil). */
export const MATCH_SELECT =
  "id, status, created_at, created_by, match_members(user_id, status, color, position, profile:profiles(username, display_name, avatar_url))"

/**
 * Os matches de quem está logado (a RLS só devolve os seus), do mais novo
 * para o mais velho. `ready = false`: a migração 30 ainda não rodou.
 */
export async function getMyMatches(): Promise<{ ready: boolean; matches: MatchView[] }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return { ready: !isMissingSchema(error), matches: [] }
  return { ready: true, matches: parseMatches(data) }
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

/**
 * As linhas da cópia, só o que as contas usam (a página do item precisa da
 * cópia inteira para saber o que é "Em comum" e o que é sugestão).
 */
export async function getMatchCopyRows(categoryId: string): Promise<MatchCopyRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("entries")
    .select("id, rating, match_owner_id, match_key, match_color")
    .eq("category_id", categoryId)
  if (error) return []
  return (data ?? []) as MatchCopyRow[]
}

/** A cópia pronta para a tela: o match (as pessoas) e as marcações de cada item. */
export async function getMatchCopy(
  category: { id: string; match_id?: string | null },
  meId: string,
  rows?: MatchCopyRow[]
) {
  const [match, copyRows] = await Promise.all([
    category.match_id ? getMatchById(category.match_id) : Promise.resolve(null),
    rows ? Promise.resolve(rows) : getMatchCopyRows(category.id),
  ])
  return decorateMatchCopy({ rows: copyRows, match, meId })
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
