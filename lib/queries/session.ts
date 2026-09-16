import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/domain/types"

export interface SessionUser {
  id: string
  email: string | null
}

/**
 * Quem está logado.
 *
 * `getClaims()` valida o JWT localmente quando o projeto usa chave assimétrica
 * — nesses casos, identificar o usuário não custa round trip nenhum. O
 * middleware já fez o `getUser()` completo nesta mesma requisição, e quem
 * autoriza de verdade é a RLS.
 *
 * `cache` deduplica a chamada dentro do mesmo render.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null
  return {
    id: String(data.claims.sub),
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

/** O perfil de quem está logado. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle()

  return (data as Profile | null) ?? null
})

/** Nome para exibir, com queda para o username. */
export function displayNameOf(profile: Pick<Profile, "display_name" | "username"> | null): string {
  if (!profile) return "Você"
  return profile.display_name?.trim() || profile.username
}
