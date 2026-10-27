import type { SupabaseClient } from "@supabase/supabase-js"

import { LETTERBOXD_NOT_FOUND, LETTERBOXD_NOT_READY } from "@/lib/domain/connected"
import { isMissingSchema } from "@/lib/domain/errors"
import {
  letterboxdDetail,
  parseLetterboxdTodo,
  TMDB_DETAILS_BATCH,
  type LetterboxdDetail,
} from "@/lib/domain/tmdb"
import { letterboxdTitleKey } from "@/lib/import/letterboxd"
import type { LetterboxdFeed, LetterboxdFeedFilm } from "@/lib/import/letterboxd-rss"
import { fetchLetterboxdFeed } from "@/lib/letterboxd/client"
import { serverSecret } from "@/lib/steam/client"
import { mapLimit } from "@/lib/steam/sync"
import { fetchTmdbMovie, tmdbApiKey } from "@/lib/tmdb/client"

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
  options: {
    feed?: LetterboxdFeed
    /**
     * Quantos filmes ganham os detalhes do TMDB nesta rodada (migração 43).
     * A rodada diária e o conectar têm tempo; abrir a categoria, menos.
     */
    detailsBatch?: number
  } = {}
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

  // Os detalhes não seguram a sincronização: falhou, fica para a próxima.
  await syncLetterboxdDetails(supabase, secret, userId, result.feed.films, {
    batch: options.detailsBatch ?? TMDB_DETAILS_BATCH,
  }).catch(() => undefined)

  return {
    ok: true,
    created: typeof applied.created === "number" ? applied.created : 0,
    updated: typeof applied.updated === "number" ? applied.updated : 0,
    categoryId: typeof applied.category_id === "string" ? applied.category_id : null,
  }
}

/**
 * Diretor, gênero, duração, país e sinopse pelo TMDB (migração 43), aos
 * poucos: a cada rodada, os próximos filmes da categoria sem detalhes (os mais
 * novos primeiro). O do feed já vem com o id do TMDB; o do arquivo é buscado
 * pelo título e o ano. Sem a chave do TMDB ou sem a migração, não faz nada.
 */
async function syncLetterboxdDetails(
  supabase: SupabaseClient,
  secret: string,
  userId: string,
  films: LetterboxdFeedFilm[],
  { batch }: { batch: number }
): Promise<void> {
  if (batch <= 0 || !tmdbApiKey()) return
  const { data, error } = await supabase.rpc("letterboxd_details_todo", {
    p_secret: secret,
    p_user: userId,
    p_limit: batch,
  })
  if (error) return
  const tmdbByKey = new Map(
    films.flatMap((film) => (film.tmdb ? [[film.key, film.tmdb] as const] : []))
  )

  const details = await mapLimit(
    parseLetterboxdTodo(data),
    5,
    async (film): Promise<LetterboxdDetail | null> => {
      const movie = await fetchTmdbMovie({
        tmdbId: tmdbByKey.get(letterboxdTitleKey(film.name, film.year)) ?? null,
        name: film.name,
        year: film.year,
      })
      // O TMDB não respondeu: não marca, tenta na próxima rodada.
      if (movie === undefined) return null
      return letterboxdDetail(film.id, movie)
    }
  )
  const ready = details.filter((detail): detail is LetterboxdDetail => detail !== null)
  if (ready.length === 0) return
  await supabase.rpc("letterboxd_apply_details", {
    p_secret: secret,
    p_user: userId,
    p_details: ready,
  })
}
