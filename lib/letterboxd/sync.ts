import type { SupabaseClient } from "@supabase/supabase-js"

import { LETTERBOXD_NOT_FOUND, LETTERBOXD_NOT_READY } from "@/lib/domain/connected"
import { isMissingSchema } from "@/lib/domain/errors"
import type { LetterboxdFeed } from "@/lib/import/letterboxd-rss"
import { fetchLetterboxdFeed } from "@/lib/letterboxd/client"
import { serverSecret } from "@/lib/steam/client"

export type LetterboxdSyncResult =
  | { ok: true; created: number; updated: number; categoryId: string | null }
  | { ok: false; reason: "not-found" | "not-connected" | "not-ready" | "failed"; error: string }

/**
 * Lê o feed do @ e grava pela função `letterboxd_apply` (migração 39), que
 * abre só com o segredo do servidor — o mesmo caminho da Steam. Falha
 * registrada fica em `connected_accounts.last_error`.
 *
 * Serve à rodada diária (cliente sem sessão), ao "Sincronizar agora", à
 * primeira sincronização e ao abrir a categoria (cliente com a sessão).
 */
export async function syncLetterboxdAccount(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  options: { feed?: LetterboxdFeed } = {}
): Promise<LetterboxdSyncResult> {
  const secret = serverSecret()
  if (!secret) {
    return { ok: false, reason: "failed", error: "Falta o CRON_SECRET no servidor." }
  }

  async function report(error: string) {
    await supabase.rpc("connected_report_error", {
      p_secret: secret,
      p_user: userId,
      p_provider: "letterboxd",
      p_error: error,
    })
  }

  let result
  try {
    result = options.feed
      ? { status: "ok" as const, feed: options.feed }
      : await fetchLetterboxdFeed(username)
  } catch {
    const message = "O Letterboxd não respondeu agora. Tente de novo em alguns minutos."
    await report(message)
    return { ok: false, reason: "failed", error: message }
  }
  if (result.status === "not_found") {
    await report(LETTERBOXD_NOT_FOUND)
    return { ok: false, reason: "not-found", error: LETTERBOXD_NOT_FOUND }
  }

  const { data, error } = await supabase.rpc("letterboxd_apply", {
    p_secret: secret,
    p_user: userId,
    p_films: result.feed.films,
    p_display_name: result.feed.displayName,
  })
  if (error) {
    if (isMissingSchema(error)) {
      return { ok: false, reason: "not-ready", error: LETTERBOXD_NOT_READY }
    }
    const message =
      String((error as { code?: unknown }).code) === "42501"
        ? "O segredo do servidor não bate com o gravado no banco (veja o topo do 24_connected_accounts.sql)."
        : "Não deu para gravar os filmes agora. Tente de novo."
    return { ok: false, reason: "failed", error: message }
  }

  const applied = data as {
    status?: unknown
    created?: unknown
    updated?: unknown
    category_id?: unknown
  } | null
  if (applied?.status !== "ok") {
    return {
      ok: false,
      reason: "not-connected",
      error: "O Letterboxd não está conectado a esta conta.",
    }
  }
  return {
    ok: true,
    created: typeof applied.created === "number" ? applied.created : 0,
    updated: typeof applied.updated === "number" ? applied.updated : 0,
    categoryId: typeof applied.category_id === "string" ? applied.category_id : null,
  }
}
