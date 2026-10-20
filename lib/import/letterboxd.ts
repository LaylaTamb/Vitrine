/**
 * Letterboxd (a exportação em Settings → Data): só os filmes ASSISTIDOS — a
 * watchlist fica de fora. Junta os arquivos:
 *   watched.csv  — Date, Name, Year, Letterboxd URI (a do filme);
 *   ratings.csv  — … + Rating (a nota de hoje, 0,5 a 5);
 *   diary.csv    — … + Rating, Watched Date (cada vez que viu);
 *   reviews.csv  — … + Review, Watched Date.
 * No diário e nas resenhas, o "Letterboxd URI" é o do REGISTRO, não o do
 * filme: ali a ligação é por nome + ano.
 */

import { csvRecords, pick } from "./csv"

export const LETTERBOXD_FOLDER = "Letterboxd"
export const LETTERBOXD_CATEGORY = "Filmes"

/** Os campos da categoria Filmes (a nota é a das estrelas do item). */
export const LETTERBOXD_ESTRUTURA = [
  { id: "f_ano", nome: "Ano", tipo: "int" as const },
  { id: "f_assistido", nome: "Data em que assistiu", tipo: "date" as const },
  { id: "f_resenha", nome: "Resenha", tipo: "str" as const },
]

export type LetterboxdKind = "watched" | "ratings" | "diary" | "reviews"

export interface LetterboxdFilm {
  /** O \`source_id\`: a URI do filme (ou, sem ela, "titulo:nome|ano"). */
  key: string
  name: string
  year: number | null
  rating: number | null
  /** AAAA-MM-DD: a vez mais recente. */
  watchedDate: string | null
  review: string | null
}

const MAX_REVIEW = 5000

/** Qual arquivo é, pelo nome (watchlist e o resto ficam de fora). */
export function letterboxdKind(path: string): LetterboxdKind | null {
  const file = (path.split(/[\\/]/).pop() ?? "").toLowerCase()
  if (file === "watched.csv") return "watched"
  if (file === "ratings.csv") return "ratings"
  if (file === "diary.csv") return "diary"
  if (file === "reviews.csv") return "reviews"
  return null
}

function titleKey(name: string, year: number | null): string {
  return `${name.trim().toLowerCase()}|${year ?? ""}`
}

function yearOf(value: string): number | null {
  const year = Number(value)
  return Number.isInteger(year) && year > 1850 && year < 2200 ? year : null
}

function ratingOf(value: string): number | null {
  const rating = Number(value.replace(",", "."))
  if (!Number.isFinite(rating) || rating <= 0) return null
  return Math.min(5, Math.round(rating * 2) / 2)
}

function dateOf(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/**
 * Os arquivos (texto) → os filmes assistidos, um por filme. A nota de hoje
 * vem do ratings.csv; sem ela, a do registro mais recente do diário.
 */
export function mergeLetterboxd(files: Partial<Record<LetterboxdKind, string>>): LetterboxdFilm[] {
  const byKey = new Map<string, LetterboxdFilm>()
  const byTitle = new Map<string, LetterboxdFilm>()

  function film(name: string, year: number | null, uri: string | null): LetterboxdFilm {
    const existing = (uri && byKey.get(uri)) || byTitle.get(titleKey(name, year))
    if (existing) return existing
    const created: LetterboxdFilm = {
      key: (uri || `titulo:${titleKey(name, year)}`).slice(0, 200),
      name: name.slice(0, 200),
      year,
      rating: null,
      watchedDate: null,
      review: null,
    }
    byKey.set(created.key, created)
    byTitle.set(titleKey(name, year), created)
    return created
  }

  const rows = (kind: LetterboxdKind) => (files[kind] ? csvRecords(files[kind]!).records : [])

  for (const record of rows("watched")) {
    const name = pick(record, ["Name"])
    if (!name) continue
    const entry = film(name, yearOf(pick(record, ["Year"])), pick(record, ["Letterboxd URI"]) || null)
    entry.watchedDate = laterDate(entry.watchedDate, dateOf(pick(record, ["Date"])))
  }

  for (const record of rows("ratings")) {
    const name = pick(record, ["Name"])
    if (!name) continue
    const entry = film(name, yearOf(pick(record, ["Year"])), pick(record, ["Letterboxd URI"]) || null)
    entry.rating = ratingOf(pick(record, ["Rating"])) ?? entry.rating
  }

  // Diário: a data de cada vez que viu e, sem ratings.csv, a nota mais recente.
  const diaryRating = new Map<LetterboxdFilm, { date: string; rating: number }>()
  for (const record of rows("diary")) {
    const name = pick(record, ["Name"])
    if (!name) continue
    const entry = film(name, yearOf(pick(record, ["Year"])), null)
    const date = dateOf(pick(record, ["Watched Date"])) ?? dateOf(pick(record, ["Date"]))
    entry.watchedDate = laterDate(entry.watchedDate, date)
    const rating = ratingOf(pick(record, ["Rating"]))
    const previous = diaryRating.get(entry)
    if (rating && (!previous || (date ?? "") >= previous.date)) {
      diaryRating.set(entry, { date: date ?? "", rating })
    }
  }
  for (const [entry, { rating }] of diaryRating) entry.rating ??= rating

  // Resenhas: a mais recente de cada filme.
  const reviewDate = new Map<LetterboxdFilm, string>()
  for (const record of rows("reviews")) {
    const name = pick(record, ["Name"])
    const review = pick(record, ["Review"])
    if (!name || !review) continue
    const entry = film(name, yearOf(pick(record, ["Year"])), null)
    const date = dateOf(pick(record, ["Watched Date"])) ?? dateOf(pick(record, ["Date"])) ?? ""
    if (!reviewDate.has(entry) || date >= (reviewDate.get(entry) ?? "")) {
      reviewDate.set(entry, date)
      entry.review = review.slice(0, MAX_REVIEW)
    }
    entry.watchedDate = laterDate(entry.watchedDate, dateOf(pick(record, ["Watched Date"])))
  }

  return [...byKey.values()]
}
