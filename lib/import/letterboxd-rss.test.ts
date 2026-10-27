import { describe, expect, it } from "vitest"

import {
  letterboxdFeedUrl,
  normalizeLetterboxdUsername,
  parseLetterboxdFeed,
} from "./letterboxd-rss"

function item(fields: {
  title: string
  year?: string
  rating?: string
  watched?: string
  description?: string
  tmdb?: string
}): string {
  return `<item>
    <title>${fields.title}</title>
    <link>https://letterboxd.com/fulana/film/x/</link>
    <letterboxd:watchedDate>${fields.watched ?? ""}</letterboxd:watchedDate>
    <letterboxd:filmTitle>${fields.title}</letterboxd:filmTitle>
    ${fields.year ? `<letterboxd:filmYear>${fields.year}</letterboxd:filmYear>` : ""}
    ${fields.rating ? `<letterboxd:memberRating>${fields.rating}</letterboxd:memberRating>` : ""}
    ${fields.tmdb ? `<tmdb:movieId>${fields.tmdb}</tmdb:movieId>` : ""}
    <description><![CDATA[ ${fields.description ?? ""} ]]></description>
  </item>`
}

const POSTER = `<p><img src="https://a.ltrbxd.com/resized/film-poster/1/2/3/123-duna-0-600-0-900-crop.jpg?v=1"/></p>`

function feed(items: string[]): string {
  return `<?xml version='1.0' encoding='utf-8'?>
  <rss version="2.0" xmlns:letterboxd="https://letterboxd.com">
    <channel>
      <title>Letterboxd - Fulana de Tal</title>
      ${items.join("\n")}
    </channel>
  </rss>`
}

describe("Letterboxd pelo @", () => {
  it("aceita o @, o nome e o link do perfil", () => {
    expect(normalizeLetterboxdUsername("@Fulana_1")).toBe("fulana_1")
    expect(normalizeLetterboxdUsername("  fulana ")).toBe("fulana")
    expect(normalizeLetterboxdUsername("https://letterboxd.com/Fulana/films/")).toBe("fulana")
    expect(normalizeLetterboxdUsername("letterboxd.com/fulana")).toBe("fulana")
    expect(normalizeLetterboxdUsername("fulana de tal")).toBeNull()
    expect(normalizeLetterboxdUsername("")).toBeNull()
    expect(letterboxdFeedUrl("fulana")).toBe("https://letterboxd.com/fulana/rss/")
  })

  it("lê filme, ano, nota, data, pôster e o nome do perfil", () => {
    const parsed = parseLetterboxdFeed(
      feed([
        item({
          title: "Duna",
          year: "2021",
          rating: "4.5",
          watched: "2026-10-20",
          tmdb: "438631",
          description: `${POSTER} <p>Watched on Tuesday October 20, 2026.</p>`,
        }),
      ])
    )
    expect(parsed.displayName).toBe("Fulana de Tal")
    expect(parsed.films).toEqual([
      {
        key: "titulo:duna|2021",
        name: "Duna",
        year: 2021,
        rating: 4.5,
        watched: "2026-10-20",
        poster: "https://a.ltrbxd.com/resized/film-poster/1/2/3/123-duna-0-600-0-900-crop.jpg?v=1",
        review: null,
        tmdb: 438631,
      },
    ])
  })

  it("pega a resenha, sem o pôster e sem o aviso de spoiler, e decodifica o texto", () => {
    const [film] = parseLetterboxdFeed(
      feed([
        item({
          title: "Amélie &amp; Cia",
          year: "2001",
          description: `${POSTER} <p><em>This review may contain spoilers.</em></p> <p>Lindo &amp; triste.</p> <p>Veria de novo.</p>`,
        }),
      ])
    ).films
    expect(film.name).toBe("Amélie & Cia")
    expect(film.review).toBe("Lindo & triste.\n\nVeria de novo.")
    expect(film.rating).toBeNull()
  })

  it("filme visto de novo vale pela vez mais recente; item sem filme fica de fora", () => {
    const parsed = parseLetterboxdFeed(
      feed([
        item({ title: "Duna", year: "2021", rating: "3.0", watched: "2026-10-20" }),
        item({
          title: "Duna",
          year: "2021",
          rating: "4.0",
          watched: "2025-01-02",
          description: POSTER,
        }),
        `<item><title>Minha lista</title><description>uma lista</description></item>`,
      ])
    )
    expect(parsed.films).toHaveLength(1)
    expect(parsed.films[0]).toMatchObject({ rating: 3, watched: "2026-10-20" })
    // o que a vez mais recente não tem, a outra completa
    expect(parsed.films[0].poster).toContain("ltrbxd.com")
  })

  it("nota zero ou estranha não vira nota; pôster de fora não entra", () => {
    const [film] = parseLetterboxdFeed(
      feed([
        item({
          title: "X",
          rating: "0",
          description: `<p><img src="https://exemplo.com/a.jpg"/></p>`,
        }),
      ])
    ).films
    expect(film.rating).toBeNull()
    expect(film.year).toBeNull()
    expect(film.key).toBe("titulo:x|")
    expect(film.poster).toBeNull()
  })
})
