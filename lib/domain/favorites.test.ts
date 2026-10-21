import { describe, expect, it } from "vitest"

import {
  addableCategories,
  nextFavorite,
  tabCategories,
  tabOrder,
  type FavoriteRow,
} from "./favorites"

const categories = [
  { id: "rest", kind: "normal" },
  { id: "film", kind: "normal" },
  { id: "livr" },
  { id: "caixa", kind: "inbox" },
]

describe("estrela de favorito", () => {
  it("marca, troca e desmarca", () => {
    expect(nextFavorite(null, "kino")).toBe("kino")
    expect(nextFavorite("kino", "moco")).toBe("moco")
    expect(nextFavorite("moco", "moco")).toBeNull()
  })

  it("marcar a estrela não põe a categoria na aba", () => {
    const rows: FavoriteRow[] = [
      { category_id: "rest", owner_id: "eu", entry_id: "kino", tab_position: null },
    ]
    expect(tabOrder(rows)).toEqual([])
  })
})

describe("aba Favoritos: categorias inteiras", () => {
  const rows: FavoriteRow[] = [
    { category_id: "rest", owner_id: "eu", entry_id: null, tab_position: 2 },
    { category_id: "film", owner_id: "eu", entry_id: "matrix", tab_position: 0 },
    { category_id: "sumiu", owner_id: "eu", entry_id: null, tab_position: 1 },
    { category_id: "livr", owner_id: "eu", entry_id: null, tab_position: null },
  ]

  it("na ordem escolhida — com ou sem estrelinha —, sem as que não existem mais", () => {
    const order = tabOrder(rows)
    expect(order).toEqual(["film", "sumiu", "rest"])
    expect(tabCategories(order, categories).map((category) => category.id)).toEqual([
      "film",
      "rest",
    ])
  })

  it("para adicionar: o que não está na aba, sem a A organizar", () => {
    expect(addableCategories(["film", "rest"], categories).map((category) => category.id)).toEqual(
      ["livr"]
    )
  })
})
