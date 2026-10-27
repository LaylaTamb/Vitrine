/**
 * O Letterboxd pelo @: o feed público do perfil (`letterboxd.com/<@>/rss/`)
 * traz os ~50 registros mais recentes do diário — filme, ano, nota, data e
 * pôster (e a resenha, quando tem). Sem biblioteca de XML: o feed é simples e
 * estável, e só estas tags interessam. Funções puras (os testes cobrem).
 */

import { letterboxdTitleKey } from "./letterboxd"

/** Um filme do feed, já no formato que a função do banco recebe. */
export interface LetterboxdFeedFilm {
  key: string
  name: string
  year: number | null
  rating: number | null
  /** AAAA-MM-DD: a vez mais recente no feed. */
  watched: string | null
  poster: string | null
  review: string | null
  /** O id do filme no TMDB (`<tmdb:movieId>`): os detalhes saem dele, sem busca. */
  tmdb: number | null
}

export interface LetterboxdFeed {
  /** O nome do perfil ("Letterboxd - Fulana" → "Fulana"). */
  displayName: string | null
  films: LetterboxdFeedFilm[]
}

const USERNAME = /^[a-z0-9_]{1,40}$/
const MAX_REVIEW = 5000

/**
 * O que a pessoa digita → o @ do Letterboxd: "@Fulana", "fulana" ou o link
 * do perfil ("https://letterboxd.com/fulana/films/"). `null` = não serve.
 */
export function normalizeLetterboxdUsername(raw: string): string | null {
  let text = raw.trim()
  const fromLink = /letterboxd\.com\/([^/?#\s]+)/i.exec(text)
  if (fromLink) text = fromLink[1]
  text = text.replace(/^@/, "").toLowerCase()
  return USERNAME.test(text) ? text : null
}

/** O endereço do feed de um @ já normalizado. */
export function letterboxdFeedUrl(username: string): string {
  return `https://letterboxd.com/${username}/rss/`
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/** O texto de uma tag (com ou sem CDATA), ou `null`. */
function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)
  if (!match) return null
  const raw = match[1].trim()
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(raw)
  return cdata ? cdata[1] : decodeEntities(raw)
}

function ratingOf(value: string | null): number | null {
  const rating = Number(value)
  if (!value || !Number.isFinite(rating) || rating <= 0) return null
  return Math.min(5, Math.round(rating * 2) / 2)
}

function tmdbOf(value: string | null): number | null {
  const id = Number(value)
  return value && Number.isInteger(id) && id > 0 ? id : null
}

function yearOf(value: string | null): number | null {
  const year = Number(value)
  return Number.isInteger(year) && year > 1850 && year < 2200 ? year : null
}

/** O pôster: só da casa do Letterboxd (é ele que o banco aceita). */
function posterOf(description: string): string | null {
  const match = /<img[^>]+src="([^"]+)"/i.exec(description)
  const url = match ? decodeEntities(match[1]) : null
  return url && /^https:\/\/[a-z0-9.-]*ltrbxd\.com\//i.test(url) ? url.slice(0, 500) : null
}

/**
 * A resenha: os parágrafos da descrição, menos o pôster, o "Watched on …" e
 * o aviso de spoiler. Registro sem resenha devolve `null`.
 */
function reviewOf(description: string): string | null {
  const paragraphs = [...description.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((match) => match[1])
    .filter((html) => !/<img/i.test(html))
    .map((html) =>
      decodeEntities(
        html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim()
      )
    )
    .filter(
      (text) =>
        text && !/^Watched on /i.test(text) && !/^This review may contain spoilers/i.test(text)
    )
  const review = paragraphs.join("\n\n").trim()
  return review ? review.slice(0, MAX_REVIEW) : null
}

/**
 * O XML do feed → os filmes, um por filme (o mesmo filme visto de novo vale
 * pela vez mais recente: a data e a nota dela). Itens que não são filme (uma
 * lista publicada, por exemplo) ficam de fora.
 */
export function parseLetterboxdFeed(xml: string): LetterboxdFeed {
  const channelTitle = tag(xml.split("<item>")[0] ?? "", "title")
  const displayName = channelTitle?.replace(/^Letterboxd\s*-\s*/i, "").trim() || null

  const byKey = new Map<string, LetterboxdFeedFilm>()
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1]
    const name = tag(block, "letterboxd:filmTitle")?.trim().slice(0, 200)
    if (!name) continue
    const year = yearOf(tag(block, "letterboxd:filmYear"))
    const watchedRaw = tag(block, "letterboxd:watchedDate")
    const watched = watchedRaw && /^\d{4}-\d{2}-\d{2}$/.test(watchedRaw) ? watchedRaw : null
    const description = tag(block, "description") ?? ""
    const film: LetterboxdFeedFilm = {
      key: letterboxdTitleKey(name, year),
      name,
      year,
      rating: ratingOf(tag(block, "letterboxd:memberRating")),
      watched,
      poster: posterOf(description),
      review: reviewOf(description),
      tmdb: tmdbOf(tag(block, "tmdb:movieId")),
    }

    const previous = byKey.get(film.key)
    if (!previous) {
      byKey.set(film.key, film)
      continue
    }
    // Visto de novo: vale a vez mais recente; o que ela não tiver, a outra completa.
    const newer = (film.watched ?? "") > (previous.watched ?? "") ? film : previous
    const older = newer === film ? previous : film
    byKey.set(film.key, {
      ...newer,
      rating: newer.rating ?? older.rating,
      poster: newer.poster ?? older.poster,
      review: newer.review ?? older.review,
      tmdb: newer.tmdb ?? older.tmdb,
    })
  }

  return { displayName, films: [...byKey.values()] }
}
