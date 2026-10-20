import { isMissingSchema } from "@/lib/domain/errors"
import { createClient } from "@/lib/supabase/server"

/** A conexão com a Steam, do jeito que as Configurações mostram. */
export interface SteamAccountView {
  displayName: string | null
  categoryId: string | null
  lastSyncedAt: string | null
  lastError: string | null
}

/**
 * A Steam de quem está logado (migração 24). `ready = false`: a tabela ainda
 * não existe (a tela pede para rodar o SQL).
 */
export async function getSteamAccount(
  userId: string
): Promise<{ ready: boolean; account: SteamAccountView | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("display_name, category_id, last_synced_at, last_error")
    .eq("user_id", userId)
    .eq("provider", "steam")
    .maybeSingle()
  if (error) return { ready: !isMissingSchema(error), account: null }
  const row = data as {
    display_name: string | null
    category_id: string | null
    last_synced_at: string | null
    last_error: string | null
  } | null
  return {
    ready: true,
    account: row
      ? {
          displayName: row.display_name,
          categoryId: row.category_id,
          lastSyncedAt: row.last_synced_at,
          lastError: row.last_error,
        }
      : null,
  }
}
