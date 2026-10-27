import "server-only"

import { parseTmdbMovie, parseTmdbSearch, type TmdbFields } from "@/lib/domain/tmdb"

/**
 * O TMDB, só no servidor. `TMDB_API_KEY` (gratuita, em themoviedb.org →
 * Configurações → API) nunca vai para o navegador. Serve tanto a "Chave da
 * API" (v3, curta) quanto o "Token de leitura" (v4, começa com "eyJ").
 */

const TIMEOUT_MS = 6_000

export function tmdbApiKey(): string | null {
  return process.env.TMDB_API_KEY?.trim() || null
}

/** Um GET no TMDB; `null` se não respondeu (tenta de novo na próxima rodada). */
async function tmdb(path: string, params: Record<string, string>): Promise<unknown | null> {
  const key = tmdbApiKey()
  if (!key) return null
  const url = new URL(`https://api.themoviedb.org/3/${path}`)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  const headers: Record<string, string> = { accept: "application/json" }
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`
  else url.searchParams.set("api_key", key)
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

/**
 * Os detalhes de um filme. Com o id (o feed do @ traz), vai direto; sem ele
 * (o que veio do arquivo), busca pelo título e o ano. `undefined` = o TMDB
 * não respondeu (tenta de novo depois); `null` = não achou o filme.
 */
export async function fetchTmdbMovie(input: {
  tmdbId: number | null
  name: string
  year: number | null
}): Promise<{ id: number; fields: TmdbFields } | null | undefined> {
  let id = input.tmdbId
  if (id === null) {
    const search = await tmdb("search/movie", {
      query: input.name,
      language: "pt-BR",
      include_adult: "false",
      ...(input.year ? { year: String(input.year) } : {}),
    })
    if (search === null) return undefined
    id = parseTmdbSearch(search)
    if (id === null) return null
  }
  const movie = await tmdb(`movie/${id}`, { language: "pt-BR", append_to_response: "credits" })
  if (movie === null) return undefined
  return parseTmdbMovie(movie)
}
