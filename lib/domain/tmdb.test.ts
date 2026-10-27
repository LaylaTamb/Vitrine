import { describe, expect, it } from "vitest"

import {
  countryName,
  letterboxdDetail,
  parseLetterboxdTodo,
  parseTmdbMovie,
  parseTmdbSearch,
} from "./tmdb"

describe("TMDB", () => {
  it("a busca devolve o primeiro filme", () => {
    expect(parseTmdbSearch({ results: [{ id: 550 }, { id: 1 }] })).toBe(550)
    expect(parseTmdbSearch({ results: [] })).toBeNull()
    expect(parseTmdbSearch(null)).toBeNull()
  })

  it("o filme: diretor da equipe, gêneros, duração, países em português e sinopse", () => {
    const movie = parseTmdbMovie({
      id: 550,
      runtime: 139,
      overview: " Um homem deprimido… ",
      genres: [{ name: "Drama" }, { name: "Thriller" }],
      production_countries: [{ iso_3166_1: "US" }, { iso_3166_1: "DE" }],
      credits: {
        crew: [
          { job: "Director", name: "David Fincher" },
          { job: "Producer", name: "Outra Pessoa" },
          { job: "Director", name: "David Fincher" },
        ],
      },
    })
    expect(movie).toEqual({
      id: 550,
      fields: {
        diretor: "David Fincher",
        genero: "Drama, Thriller",
        duracao: 139,
        pais: "Estados Unidos, Alemanha",
        sinopse: "Um homem deprimido…",
      },
    })
    expect(parseTmdbMovie({ id: 1, runtime: 0, overview: "" })).toEqual({ id: 1, fields: {} })
    expect(parseTmdbMovie({})).toBeNull()
  })

  it("país com código estranho volta como veio", () => {
    expect(countryName("BR")).toBe("Brasil")
    expect(countryName("??")).toBe("??")
  })

  it("os pendentes e o que vai para o banco", () => {
    expect(
      parseLetterboxdTodo([
        { id: "a", name: " Clube da Luta ", year: 1999 },
        { id: "b", name: "Sem ano", year: null },
        { id: "c", name: "" },
        { name: "sem id" },
      ])
    ).toEqual([
      { id: "a", name: "Clube da Luta", year: 1999 },
      { id: "b", name: "Sem ano", year: null },
    ])
    expect(letterboxdDetail("a", { id: 550, fields: { diretor: "David Fincher" } })).toEqual({
      id: "a",
      tmdb: 550,
      diretor: "David Fincher",
    })
    expect(letterboxdDetail("b", null)).toEqual({ id: "b" })
  })
})
