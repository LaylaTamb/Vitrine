import { describe, expect, it } from "vitest"

import {
  canFavorite,
  nextTabPosition,
  tabCategories,
  tabOrder,
  withFavorite,
  type FavoriteRow,
} from "./favorites"

const categories = [
  { id: "rest", kind: "normal" },
  { id: "film", kind: "normal" },
  { id: "livr" },
  { id: "caixa", kind: "inbox" },
]

describe("categorias favoritas", () => {
  const rows: FavoriteRow[] = [
    { category_id: "rest", tab_position: 2 },
    { category_id: "film", tab_position: 0 },
    { category_id: "sumiu", tab_position: 1 },
    { category_id: "livr", tab_position: null },
  ]

  it("na ordem da pessoa, sem as desmarcadas nem as que não existem mais", () => {
    const order = tabOrder(rows)
    expect(order).toEqual(["film", "sumiu", "rest"])
    expect(tabCategories(order, categories).map((category) => category.id)).toEqual([
      "film",
      "rest",
    ])
  })

  it("toda categoria pode ser favorita, menos a A organizar", () => {
    expect(categories.filter(canFavorite).map((category) => category.id)).toEqual([
      "rest",
      "film",
      "livr",
    ])
  })

  it("marcar põe no fim; desmarcar tira; marcar de novo não duplica", () => {
    expect(withFavorite(["film"], "rest", true)).toEqual(["film", "rest"])
    expect(withFavorite(["film", "rest"], "film", false)).toEqual(["rest"])
    expect(withFavorite(["film", "rest"], "film", true)).toEqual(["rest", "film"])
    expect(withFavorite([], "livr", false)).toEqual([])
  })

  it("a nova favorita vai depois de todas as outras", () => {
    expect(nextTabPosition([])).toBe(0)
    expect(nextTabPosition([null, null])).toBe(0)
    expect(nextTabPosition([2, null, 0, 5])).toBe(6)
  })
})
