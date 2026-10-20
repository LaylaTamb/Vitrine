import { describe, expect, it } from "vitest"

import { normalizeCategoryName, parseTemplates, usedByLabel } from "./templates"

describe("nome normalizado (o mesmo do banco)", () => {
  it("minúsculas, sem acento, sem pontuação", () => {
    expect(normalizeCategoryName("  Séries de TV!! ")).toBe("serie de tv")
    expect(normalizeCategoryName("Cafés & Padarias")).toBe("cafe padaria")
    expect(normalizeCategoryName("Top 10")).toBe("top 10")
  })

  it("singular simples por palavra", () => {
    expect(normalizeCategoryName("Filmes")).toBe("filme")
    expect(normalizeCategoryName("Filme")).toBe("filme")
    expect(normalizeCategoryName("Lições")).toBe("licao")
    expect(normalizeCategoryName("Animais")).toBe("animal")
    expect(normalizeCategoryName("Bares")).toBe("bar")
    expect(normalizeCategoryName("Flores")).toBe("flor")
    expect(normalizeCategoryName("Luzes")).toBe("luz")
    expect(normalizeCategoryName("Álbuns")).toBe("album")
    expect(normalizeCategoryName("Jogos de tabuleiro")).toBe("jogo de tabuleiro")
  })

  it("não mexe em palavra curta", () => {
    expect(normalizeCategoryName("Os Bons")).toBe("os bom")
    expect(normalizeCategoryName("Três mais")).toBe("tre mai")
    expect(normalizeCategoryName("")).toBe("")
  })

  it("aplicar duas vezes dá o mesmo resultado nos casos comuns", () => {
    for (const name of ["Filmes", "Bares", "Animais", "Lições", "Álbuns", "Restaurantes"]) {
      const once = normalizeCategoryName(name)
      expect(normalizeCategoryName(once)).toBe(once)
    }
  })
})

describe("modelos que voltam da busca", () => {
  it("confere campo a campo e preserva os ids dos campos", () => {
    const [template] = parseTemplates([
      {
        id: "c1",
        name: "Vinhos",
        icon: "🍷",
        color: null,
        estrutura: [
          { id: "f_uva", nome: "Uva", tipo: "str" },
          { id: "f_tipo", nome: "Tipo", tipo: "select", opcoes: ["Tinto", "Branco"] },
        ],
        rating_enabled: true,
        default_sort: "nada",
        quick_field: "f_uva",
        owner: { username: "ana", display_name: "Ana", avatar_url: null },
        uses: 3,
      },
    ])
    expect(template.estrutura.map((field) => field.id)).toEqual(["f_uva", "f_tipo"])
    expect(template.defaultSort).toBe("rating_desc")
    expect(template.quickField).toBe("f_uva")
    expect(template.uses).toBe(3)
  })

  it("descarta o que não fecha", () => {
    expect(
      parseTemplates([
        { id: "c1", name: "Sem campos", estrutura: [], owner: { username: "ana" } },
        { id: "c2", name: "Sem dono", estrutura: [{ id: "a", nome: "A", tipo: "str" }] },
        null,
      ])
    ).toEqual([])
    expect(parseTemplates("x")).toEqual([])
  })

  it("campo principal que não existe volta para o Nome", () => {
    const [template] = parseTemplates([
      {
        id: "c1",
        name: "Livros",
        estrutura: [{ id: "f_autor", nome: "Autor", tipo: "str" }],
        rating_enabled: false,
        quick_field: "rating",
        owner: { username: "ana" },
      },
    ])
    expect(template.quickField).toBe("name")
    expect(template.ratingEnabled).toBe(false)
  })

  it("diz quantas pessoas usaram", () => {
    expect(usedByLabel(0)).toBe("ninguém usou ainda")
    expect(usedByLabel(1)).toBe("usado por 1 pessoa")
    expect(usedByLabel(12)).toBe("usado por 12 pessoas")
  })
})
