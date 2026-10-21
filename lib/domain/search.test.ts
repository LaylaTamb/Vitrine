import { describe, expect, it } from "vitest"

import {
  isSearching,
  matchReason,
  normalizeSearch,
  parseItemHits,
  pathLabel,
  searchByName,
} from "./search"

describe("busca nas Coleções", () => {
  it("ignora acento, maiúscula e espaço sobrando", () => {
    expect(normalizeSearch("  Café  da MANHÃ ")).toBe("cafe da manha")
    expect(normalizeSearch("Ação")).toBe("acao")
    expect(isSearching("a")).toBe(false)
    expect(isSearching(" é ")).toBe(false)
    expect(isSearching("ca")).toBe(true)
  })

  it("pelo nome: quem começa com o texto vem primeiro", () => {
    const items = [
      { id: "1", name: "Bares do centro" },
      { id: "2", name: "Restaurantes" },
      { id: "3", name: "Restaurantes japoneses" },
      { id: "4", name: "Melhores restaurantes" },
    ]
    expect(searchByName(items, "restaurante").map((item) => item.id)).toEqual(["2", "3", "4"])
    expect(searchByName(items, "BARES").map((item) => item.id)).toEqual(["1"])
    expect(searchByName(items, "r")).toEqual([])
  })

  it("o caminho de uma pasta", () => {
    const folders = [
      { id: "a", name: "Bebidas", parent_folder_id: null, display_order: 0 },
      { id: "b", name: "Suco", parent_folder_id: "a", display_order: 0 },
    ]
    expect(pathLabel(folders, "b")).toBe("Coleções › Bebidas › Suco")
    expect(pathLabel(folders, null)).toBe("Coleções")
  })

  it("lê os itens do banco e diz por que cada um apareceu", () => {
    const [byField, byTag, byName] = parseItemHits([
      {
        id: "e1",
        name: "Feijoada da Tia",
        category_id: "c1",
        category_name: "Restaurantes",
        rating: "4.5",
        matched: "field",
        match_value: "Pinheiros",
        match_label: "Bairro",
      },
      { id: "e2", name: "Kino", category_id: "c1", rating: null, matched: "tag", match_value: "barato" },
      { id: "e3", name: "Duna", category_id: "c2", rating: 0, matched: "name" },
      { id: "", category_id: "c2" },
    ])
    expect(byField).toMatchObject({ rating: 4.5, categoryName: "Restaurantes" })
    expect(matchReason(byField)).toBe("Bairro: Pinheiros")
    expect(matchReason(byTag)).toBe("tag barato")
    expect(byName.rating).toBeNull()
    expect(matchReason(byName)).toBe("")
  })
})
