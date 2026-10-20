import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/domain/types"
import {
  USERNAME_WINDOW_DAYS,
  usernameAllowance,
  type UsernameAllowance,
} from "@/lib/domain/username"

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
  // `*`: traz também as colunas das migrações 12 e 14 (`default_visibility`,
  // `public_notice_seen_at`…) quando já rodaram — e não quebra quando ainda
  // não rodaram (pedir a coluna pelo nome quebraria).
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  return (data as Profile | null) ?? null
})

/**
 * Quantas trocas de @ ainda cabem agora, a partir das trocas dos últimos 14
 * dias (migração 15). Sem a tabela (antes da migração): nenhuma troca feita.
 */
export async function getMyUsernameAllowance(userId: string): Promise<UsernameAllowance> {
  const supabase = await createClient()
  const now = new Date()
  const since = new Date(now.getTime() - USERNAME_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from("username_changes")
    .select("changed_at")
    .eq("profile_id", userId)
    .gt("changed_at", since.toISOString())
  const rows = error ? [] : ((data ?? []) as { changed_at: string }[])
  return usernameAllowance(
    rows.map((row) => row.changed_at),
    now
  )
}

/** Nome para exibir, com queda para o username. */
export function displayNameOf(profile: Pick<Profile, "display_name" | "username"> | null): string {
  if (!profile) return "Você"
  return profile.display_name?.trim() || profile.username
}
