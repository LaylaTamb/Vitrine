import { cache } from "react"

import type { Profile } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"

/**
 * Seguidores, seguindo e bloqueios (migração 14). Sem a migração (tabelas
 * ausentes), tudo volta zerado — as telas continuam funcionando.
 */

export interface ProfileSocial {
  followers: number
  following: number
  /** Quem está vendo segue esta pessoa. */
  iFollow: boolean
  /** Esta pessoa segue quem está vendo. */
  followsMe: boolean
  /** Quem está vendo bloqueou esta pessoa. */
  iBlocked: boolean
}

const NONE = Promise.resolve({ data: null, error: null })

/** Contagens e a relação de `viewerId` com `profileId` — tudo junto, numa ida. */
export async function getProfileSocial(
  profileId: string,
  viewerId: string
): Promise<ProfileSocial> {
  const supabase = await createClient()
  const isMe = profileId === viewerId
  const [followers, following, iFollow, followsMe, iBlocked] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("followee_id", profileId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileId),
    isMe
      ? NONE
      : supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("followee_id", profileId)
          .maybeSingle(),
    isMe
      ? NONE
      : supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", profileId)
          .eq("followee_id", viewerId)
          .maybeSingle(),
    isMe
      ? NONE
      : supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", viewerId)
          .eq("blocked_id", profileId)
          .maybeSingle(),
  ])
  return {
    followers: followers.error ? 0 : (followers.count ?? 0),
    following: following.error ? 0 : (following.count ?? 0),
    iFollow: !iFollow.error && Boolean(iFollow.data),
    followsMe: !followsMe.error && Boolean(followsMe.data),
    iBlocked: !iBlocked.error && Boolean(iBlocked.data),
  }
}

/** Quem `viewerId` segue e quem segue `viewerId` — os botões das listas. */
export async function getMyFollows(
  viewerId: string
): Promise<{ following: Set<string>; followers: Set<string> }> {
  const supabase = await createClient()
  const [mine, theirs] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
    supabase.from("follows").select("follower_id").eq("followee_id", viewerId),
  ])
  return {
    following: new Set(
      mine.error ? [] : ((mine.data ?? []) as { followee_id: string }[]).map((row) => row.followee_id)
    ),
    followers: new Set(
      theirs.error
        ? []
        : ((theirs.data ?? []) as { follower_id: string }[]).map((row) => row.follower_id)
    ),
  }
}

export type FollowListKind = "seguidores" | "seguindo"

export type ListProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">

const PERSON = "id, username, display_name, avatar_url"

/**
 * Os seguidores (ou quem a pessoa segue), com o perfil de cada um. Perfil
 * escondido (bloqueio) não aparece.
 */
export async function getFollowList(
  profileId: string,
  kind: FollowListKind
): Promise<ListProfile[]> {
  const supabase = await createClient()
  const { data, error } =
    kind === "seguidores"
      ? await supabase
          .from("follows")
          .select(`created_at, person:profiles!follows_follower_id_fkey(${PERSON})`)
          .eq("followee_id", profileId)
          .order("created_at", { ascending: false })
      : await supabase
          .from("follows")
          .select(`created_at, person:profiles!follows_followee_id_fkey(${PERSON})`)
          .eq("follower_id", profileId)
          .order("created_at", { ascending: false })
  if (error) return []
  return ((data ?? []) as unknown as { person: ListProfile | null }[])
    .map((row) => row.person)
    .filter((person): person is ListProfile => person !== null)
}

/** Quantas notificações não lidas — o número do sininho. Sem a migração 21: zero. */
export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
  return error ? 0 : (count ?? 0)
})
