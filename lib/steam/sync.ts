import type { SupabaseClient } from "@supabase/supabase-js"

import { isMissingSchema } from "@/lib/domain/errors"
import {
  parseDetailsTodo,
  STEAM_DETAILS_BATCH,
  STEAM_NOT_READY,
  STEAM_PRIVATE,
  STEAM_RECENT_MAX,
  steamDetail,
  type SteamDetail,
  type SteamGame,
} from "@/lib/domain/steam"
import {
  fetchAppDetails,
  fetchOwnedGames,
  fetchPersonaName,
  fetchPlayerAchievements,
  serverSecret,
} from "@/lib/steam/client"

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
  options: {
    refreshName?: boolean
    /**
     * Quantos jogos ganham os detalhes nesta rodada (migração 42). A rodada
     * diária e o conectar têm tempo; abrir a categoria, menos.
     */
    detailsBatch?: number
  } = {}
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

  // Os detalhes não seguram a sincronização: falhou, fica para a próxima.
  await syncSteamDetails(supabase, secret, userId, steamId, owned.games, {
    batch: options.detailsBatch ?? STEAM_DETAILS_BATCH,
  }).catch(() => undefined)

  return {
    ok: true,
    created: typeof result.created === "number" ? result.created : 0,
    updated: typeof result.updated === "number" ? result.updated : 0,
    categoryId: typeof result.category_id === "string" ? result.category_id : null,
  }
}

/** Roda `task` em cada item, no máximo `limit` de cada vez (Steam e Letterboxd). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let start = 0; start < items.length; start += limit) {
    results.push(...(await Promise.all(items.slice(start, start + limit).map(task))))
  }
  return results
}

/**
 * Gênero, desenvolvedora, ano e conquistas (migração 42), aos poucos: a cada
 * rodada, os próximos jogos sem detalhes (os mais jogados primeiro) e as
 * conquistas dos jogados nas últimas 2 semanas. A loja limita as consultas —
 * por isso o lote. Sem a migração 42, não faz nada.
 */
async function syncSteamDetails(
  supabase: SupabaseClient,
  secret: string,
  userId: string,
  steamId: string,
  games: SteamGame[],
  { batch }: { batch: number }
): Promise<void> {
  if (batch <= 0) return
  const { data, error } = await supabase.rpc("steam_details_todo", {
    p_secret: secret,
    p_user: userId,
    p_limit: batch,
  })
  if (error) return
  const todo = parseDetailsTodo(data)
  const recent = games
    .filter((game) => game.recent && !todo.includes(String(game.appid)))
    .slice(0, Math.min(STEAM_RECENT_MAX, batch))
    .map((game) => String(game.appid))

  const details = await mapLimit(
    [
      ...todo.map((appid) => ({ appid, store: true })),
      ...recent.map((appid) => ({ appid, store: false })),
    ],
    5,
    async ({ appid, store }): Promise<SteamDetail | null> => {
      const [info, achievements] = await Promise.all([
        store ? fetchAppDetails(appid) : Promise.resolve(null),
        fetchPlayerAchievements(steamId, appid),
      ])
      // A loja não respondeu: não marca como visto, tenta na próxima rodada.
      if (store && info === null) return null
      return steamDetail(appid, info, achievements)
    }
  )
  const ready = details.filter((detail): detail is SteamDetail => detail !== null)
  if (ready.length === 0) return
  await supabase.rpc("steam_apply_details", {
    p_secret: secret,
    p_user: userId,
    p_details: ready,
  })
}
