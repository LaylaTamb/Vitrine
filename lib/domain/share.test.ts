import { describe, expect, it } from "vitest"

import { iconForCategoryName, recentCategoryIds, sharedName, suggestCategoryId } from "./share"

describe("o que chega pelo Compartilhar", () => {
  it("o texto vira o Nome, sem espaços sobrando", () => {
    expect(sharedName({ text: "  Duna   (Frank Herbert) " })).toBe("Duna (Frank Herbert)")
  })

  it("com palavras além do link, o link sai", () => {
    expect(
      sharedName({ text: "Padaria Santa Tereza https://maps.app.goo.gl/abc123", title: "Maps" })
    ).toBe("Padaria Santa Tereza")
  })

  it("sem texto, o título; sem os dois, o link (tratado como texto)", () => {
    expect(sharedName({ title: "Interestelar", url: "https://x.com/filme" })).toBe("Interestelar")
    expect(sharedName({ text: "https://open.spotify.com/album/1" })).toBe(
      "https://open.spotify.com/album/1"
    )
    expect(sharedName({ url: "https://exemplo.com" })).toBe("https://exemplo.com")
    expect(sharedName({})).toBe("")
  })

  it("corta no tamanho máximo do nome", () => {
    expect(sharedName({ text: "a".repeat(300) })).toHaveLength(160)
  })
})

describe("ícone de categoria nova", () => {
  it("acha pela palavra-chave, no singular ou plural, com ou sem acento", () => {
    expect(iconForCategoryName("Filmes de terror")).toBe("🎬")
    expect(iconForCategoryName("Séries")).toBe("📺")
    expect(iconForCategoryName("Cafés de SP")).toBe("☕")
    expect(iconForCategoryName("Livros")).toBe("📚")
    expect(iconForCategoryName("Lugares para visitar")).toBe("📍")
    expect(iconForCategoryName("Restaurantes")).toBe("🍽️")
  })

  it("sem palavra-chave, uma estrela", () => {
    expect(iconForCategoryName("Coisas aleatórias")).toBe("⭐")
  })
})

describe("categorias recentes", () => {
  it("a do último item salvo vem primeiro", () => {
    expect(
      recentCategoryIds([
        { category_id: "livros", created_at: "2026-10-01T10:00:00Z" },
        { category_id: "filmes", created_at: "2026-10-18T10:00:00Z" },
        { category_id: "livros", created_at: "2026-10-10T10:00:00Z" },
      ])
    ).toEqual(["filmes", "livros"])
  })
})

describe("palpite de categoria", () => {
  const categories = [
    { id: "filmes", name: "Filmes" },
    { id: "livros", name: "Livros" },
    { id: "rest", name: "Restaurantes" },
  ]
  const entries = [
    { name: "Duna", category_id: "livros" },
    { name: "Bar da Dona Onça", category_id: "rest" },
    { name: "O Poderoso Chefão", category_id: "filmes" },
  ]

  it("item com o mesmo nome: a categoria dele", () => {
    expect(suggestCategoryId("duna", categories, entries)).toBe("livros")
    expect(suggestCategoryId("Poderoso Chefão", categories, entries)).toBe("filmes")
  })

  it("o texto cita a categoria", () => {
    expect(suggestCategoryId("Um filme pra ver: Aftersun", categories, entries)).toBe("filmes")
  })

  it("quase todas as palavras de um item", () => {
    expect(suggestCategoryId("Bar Dona Onça — Centro", categories, entries)).toBe("rest")
  })

  it("sem palpite quando não dá para saber", () => {
    expect(suggestCategoryId("Aftersun", categories, entries)).toBeNull()
    expect(suggestCategoryId("", categories, entries)).toBeNull()
  })
})
