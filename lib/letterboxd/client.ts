import "server-only"

import {
  letterboxdFeedUrl,
  parseLetterboxdFeed,
  type LetterboxdFeed,
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
