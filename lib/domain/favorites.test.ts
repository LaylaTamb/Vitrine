import { describe, expect, it } from "vitest"

import {
  favoriteOf,
  favoritesTabItems,
  nextFavorite,
  pruneFavorites,
  tabOrder,
  withFavorite,
  withTab,
  type FavoriteRow,
} from "./favorites"

const categories = [{ id: "rest" }, { id: "film" }, { id: "livr" }]
const entries = [
  { id: "kino", category_id: "rest" },
  { id: "moco", category_id: "rest" },
  { id: "matrix", category_id: "film" },
]

describe("estrela de favorito", () => {
  it("marca, troca e desmarca", () => {
    expect(nextFavorite(null, "kino")).toBe("kino")
    expect(nextFavorite("kino", "moco")).toBe("moco")
    expect(nextFavorite("moco", "moco")).toBeNull()
  })

  it("um favorito por categoria, sem mexer na aba", () => {
    let rows: FavoriteRow[] = []
    rows = withFavorite(rows, "eu", "rest", "kino")
    rows = withFavorite(rows, "eu", "rest", "moco")
    expect(favoriteOf(rows, "rest")).toBe("moco")
    expect(rows).toHaveLength(1)
    expect(tabOrder(rows)).toEqual([]) // marcar a estrela não põe na aba
  })
})

describe("aba Favoritos", () => {
  it("monta na ordem escolhida e mostra só quem tem favorito", () => {
    let rows = withFavorite([], "eu", "rest", "kino")
    rows = withFavorite(rows, "eu", "film", "matrix")
    rows = withTab(rows, "eu", ["film", "livr", "rest"])
    expect(tabOrder(rows)).toEqual(["film", "livr", "rest"])
    expect(
      favoritesTabItems(rows, categories, entries).map((item) => [item.category.id, item.entry.id])
    ).toEqual([
      ["film", "matrix"],
      ["rest", "kino"],
    ])
  })

  it("tirar da aba mantém o favorito", () => {
    let rows = withFavorite([], "eu", "rest", "kino")
    rows = withTab(rows, "eu", ["rest"])
    rows = withTab(rows, "eu", [])
    expect(tabOrder(rows)).toEqual([])
    expect(favoriteOf(rows, "rest")).toBe("kino")
  })

  it("segue as regras do banco: categoria apagada sai, item que mudou de categoria solta", () => {
    const rows: FavoriteRow[] = [
      { category_id: "rest", owner_id: "eu", entry_id: "matrix", tab_position: 0 },
      { category_id: "sumiu", owner_id: "eu", entry_id: null, tab_position: 1 },
    ]
    expect(pruneFavorites(rows, categories, entries)).toEqual([
      { category_id: "rest", owner_id: "eu", entry_id: null, tab_position: 0 },
    ])
  })
})
