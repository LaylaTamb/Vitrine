import "server-only"

import {
  letterboxdFeedUrl,
  letterboxdFilmsPageUrl,
  parseLetterboxdFeed,
  parseLetterboxdFilmsPage,
  type LetterboxdFeed,
  type LetterboxdFilmsPage,
} from "@/lib/import/letterboxd-rss"

export type FeedResult = { status: "ok"; feed: LetterboxdFeed } | { status: "not_found" }

/**
 * Lê o feed público de um @ (já normalizado). @ que não existe volta
 * `not_found`; o Letterboxd fora do ar (ou lento) vira exceção — quem chama
 * registra o erro e tenta de novo depois.
 */
export async function fetchLetterboxdFeed(username: string): Promise<FeedResult> {
  const response = await fetch(letterboxdFeedUrl(username), {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (response.status === 404) return { status: "not_found" }
  if (!response.ok) throw new Error(`Letterboxd respondeu ${response.status}.`)
  return { status: "ok", feed: parseLetterboxdFeed(await response.text()) }
}

export type FilmsPageResult =
  { status: "ok"; page: LetterboxdFilmsPage } | { status: "not_found" } | { status: "blocked" }

/**
 * Uma página da lista de filmes vistos do perfil (o histórico inteiro, que o
 * feed não traz). O pedido se identifica como o Vitrine — sem fingir ser um
 * navegador. O Letterboxd pode recusar (403/429/503): `blocked`, e a tela
 * sugere o arquivo de exportação. Fora do ar vira exceção.
 */
export async function fetchLetterboxdFilmsPage(
  username: string,
  page: number
): Promise<FilmsPageResult> {
  const response = await fetch(letterboxdFilmsPageUrl(username, page), {
    headers: {
      Accept: "text/html",
      "User-Agent": "Vitrine/1.0 (leitura do perfil da propria pessoa)",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (response.status === 404) return { status: "not_found" }
  if ([403, 429, 503].includes(response.status)) return { status: "blocked" }
  if (!response.ok) throw new Error(`Letterboxd respondeu ${response.status}.`)
  return { status: "ok", page: parseLetterboxdFilmsPage(await response.text()) }
}
