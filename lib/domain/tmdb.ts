/**
 * TMDB (The Movie Database, gratuito) para os filmes do Letterboxd (migração
 * 43): diretor, gênero, duração, país e sinopse, em português. Aqui só o que
 * é puro — ler as respostas e montar o que vai para o banco; a rede fica em
 * `lib/tmdb/client.ts`. O TMDB recebe só o título e o ano do filme.
 */

/** Quantos filmes ganham os detalhes por sincronização. */
export const TMDB_DETAILS_BATCH = 25

/** O crédito que os termos do TMDB pedem, onde os dados aparecem. */
export const TMDB_CREDIT =
  "Diretor, gênero, duração, país e sinopse vêm do TMDB. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB."

export interface TmdbFields {
  diretor?: string
  genero?: string
  /** Em minutos (o campo Duração é do tipo tempo). */
  duracao?: number
  pais?: string
  sinopse?: string
}

const COUNTRIES = new Intl.DisplayNames(["pt-BR"], { type: "region" })

/** "US" → "Estados Unidos". Código estranho volta como veio. */
export function countryName(iso: string): string {
  try {
    return COUNTRIES.of(iso.toUpperCase()) ?? iso
  } catch {
    return iso
  }
}

function texts(list: unknown, key: string, max: number): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  for (const item of list) {
    const value = (item as Record<string, unknown> | null)?.[key]
    if (typeof value === "string" && value.trim()) seen.add(value.trim())
    if (seen.size === max) break
  }
  return [...seen]
}

/** O primeiro resultado da busca (`/search/movie`), ou `null`. */
export function parseTmdbSearch(json: unknown): number | null {
  const results = (json as { results?: unknown } | null)?.results
  const first = Array.isArray(results) ? (results[0] as { id?: unknown } | undefined) : undefined
  return typeof first?.id === "number" && Number.isInteger(first.id) ? first.id : null
}

/**
 * O filme (`/movie/{id}?append_to_response=credits`, em pt-BR): o id e os
 * campos que se sabe. Diretor sai da equipe (`job = "Director"`).
 */
export function parseTmdbMovie(json: unknown): { id: number; fields: TmdbFields } | null {
  const movie = json as Record<string, unknown> | null
  if (!movie || typeof movie.id !== "number") return null
  const crew = (movie.credits as { crew?: unknown } | undefined)?.crew
  const directors = Array.isArray(crew)
    ? texts(
        crew.filter((person) => (person as { job?: unknown } | null)?.job === "Director"),
        "name",
        3
      )
    : []
  const genres = texts(movie.genres, "name", 4)
  const countries = texts(movie.production_countries, "iso_3166_1", 3).map(countryName)
  const overview = typeof movie.overview === "string" ? movie.overview.trim() : ""
  const runtime = typeof movie.runtime === "number" ? Math.trunc(movie.runtime) : 0

  const fields: TmdbFields = {}
  if (directors.length) fields.diretor = directors.join(", ")
  if (genres.length) fields.genero = genres.join(", ")
  if (runtime > 0 && runtime < 10000) fields.duracao = runtime
  if (countries.length) fields.pais = countries.join(", ")
  if (overview) fields.sinopse = overview.slice(0, 3000)
  return { id: movie.id, fields }
}

/** Um filme pendente, como `letterboxd_details_todo` devolve. */
export interface LetterboxdTodo {
  id: string
  name: string
  year: number | null
}

export function parseLetterboxdTodo(raw: unknown): LetterboxdTodo[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): LetterboxdTodo[] => {
    const row = item as { id?: unknown; name?: unknown; year?: unknown } | null
    if (typeof row?.id !== "string" || typeof row.name !== "string" || !row.name.trim()) return []
    const year = typeof row.year === "number" && Number.isInteger(row.year) ? row.year : null
    return [{ id: row.id, name: row.name.trim(), year }]
  })
}

/** O que vai para o banco de um filme. Sem `tmdb` = não achou (marca do mesmo jeito). */
export interface LetterboxdDetail extends TmdbFields {
  id: string
  tmdb?: number
}

export function letterboxdDetail(
  entryId: string,
  movie: { id: number; fields: TmdbFields } | null
): LetterboxdDetail {
  return movie ? { id: entryId, tmdb: movie.id, ...movie.fields } : { id: entryId }
}
