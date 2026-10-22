import { isSyncDue, type ConnectedProvider } from "@/lib/domain/connected"
import { isMissingSchema } from "@/lib/domain/errors"
import { createClient } from "@/lib/supabase/server"

/** Uma conta conectada, do jeito que o Editar cartão mostra. */
export interface ConnectedAccountView {
  /** O @ (Letterboxd) ou o SteamID. */
  externalId: string
  displayName: string | null
  categoryId: string | null
  lastSyncedAt: string | null
  lastError: string | null
}

/** A conexão com a Steam (o mesmo formato das outras). */
export type SteamAccountView = ConnectedAccountView

/**
 * Uma conta de quem está logado. `ready = false`: a tabela ainda não existe
 * (migração 24). O Letterboxd só existe com a 39 — antes dela a linha nunca
 * aparece, e conectar avisa que falta rodar.
 */
export async function getConnectedAccount(
  userId: string,
  provider: ConnectedProvider
): Promise<{ ready: boolean; account: ConnectedAccountView | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("external_id, display_name, category_id, last_synced_at, last_error")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle()
  if (error) return { ready: !isMissingSchema(error), account: null }
  const row = data as {
    external_id: string
    display_name: string | null
    category_id: string | null
    last_synced_at: string | null
    last_error: string | null
  } | null
  return {
    ready: true,
    account: row
      ? {
          externalId: row.external_id,
          displayName: row.display_name,
          categoryId: row.category_id,
          lastSyncedAt: row.last_synced_at,
          lastError: row.last_error,
        }
      : null,
  }
}

/** A Steam de quem está logado (migração 24). */
export function getSteamAccount(userId: string) {
  return getConnectedAccount(userId, "steam")
}

/** O Letterboxd de quem está logado (migração 39). */
export function getLetterboxdAccount(userId: string) {
  return getConnectedAccount(userId, "letterboxd")
}

/**
 * A categoria aberta é a que a Steam ou o Letterboxd mantêm? E já passou da
 * hora de atualizar ao abrir? Só o dono recebe (a RLS esconde o resto).
 */
export async function getCategorySync(
  userId: string,
  categoryId: string
): Promise<{ provider: ConnectedProvider; due: boolean } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("provider, last_attempt_at")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { provider: string; last_attempt_at: string | null }
  if (row.provider !== "steam" && row.provider !== "letterboxd") return null
  return { provider: row.provider, due: isSyncDue(row.last_attempt_at, new Date()) }
}
