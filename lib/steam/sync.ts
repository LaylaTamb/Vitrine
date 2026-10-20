import type { SupabaseClient } from "@supabase/supabase-js"

import { isMissingSchema } from "@/lib/domain/errors"
import { STEAM_NOT_READY, STEAM_PRIVATE } from "@/lib/domain/steam"
import { fetchOwnedGames, fetchPersonaName, serverSecret } from "@/lib/steam/client"

export type SteamSyncResult =
  | { ok: true; created: number; updated: number; categoryId: string | null }
  | { ok: false; reason: "private" | "not-connected" | "not-ready" | "failed"; error: string }

/**
 * Busca os jogos na Steam e grava pela função `steam_apply` (migração 24),
 * que abre só com o segredo do servidor. Falha registrada fica em
 * `connected_accounts.last_error` — a tela de Configurações mostra.
 *
 * Serve à rodada diária (cliente sem sessão) e ao "Sincronizar agora" e à
 * primeira sincronização (cliente com a sessão da pessoa) do mesmo jeito.
 */
export async function syncSteamAccount(
  supabase: SupabaseClient,
  userId: string,
  steamId: string,
  options: { refreshName?: boolean } = {}
): Promise<SteamSyncResult> {
  const secret = serverSecret()
  if (!secret) {
    return { ok: false, reason: "failed", error: "Falta o CRON_SECRET no servidor." }
  }

  async function report(error: string) {
    await supabase.rpc("steam_report_error", { p_secret: secret, p_user: userId, p_error: error })
  }

  let owned
  let displayName: string | null = null
  try {
    ;[owned, displayName] = await Promise.all([
      fetchOwnedGames(steamId),
      options.refreshName ? fetchPersonaName(steamId) : Promise.resolve(null),
    ])
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Falta")
        ? error.message
        : "A Steam não respondeu agora. Tente de novo em alguns minutos."
    await report(message)
    return { ok: false, reason: "failed", error: message }
  }

  if (owned.status === "private") {
    await report(STEAM_PRIVATE)
    return { ok: false, reason: "private", error: STEAM_PRIVATE }
  }

  const { data, error } = await supabase.rpc("steam_apply", {
    p_secret: secret,
    p_user: userId,
    p_games: owned.games,
    p_display_name: displayName,
  })
  if (error) {
    if (isMissingSchema(error)) return { ok: false, reason: "not-ready", error: STEAM_NOT_READY }
    const message =
      String((error as { code?: unknown }).code) === "42501"
        ? "O segredo do servidor não bate com o gravado no banco (veja o topo do 24_connected_accounts.sql)."
        : "Não deu para gravar os jogos agora. Tente de novo."
    return { ok: false, reason: "failed", error: message }
  }

  const result = data as {
    status?: unknown
    created?: unknown
    updated?: unknown
    category_id?: unknown
  } | null
  if (result?.status !== "ok") {
    return {
      ok: false,
      reason: "not-connected",
      error: "A Steam não está conectada a esta conta.",
    }
  }
  return {
    ok: true,
    created: typeof result.created === "number" ? result.created : 0,
    updated: typeof result.updated === "number" ? result.updated : 0,
    categoryId: typeof result.category_id === "string" ? result.category_id : null,
  }
}
