import { describe, expect, it } from "vitest"

import {
  DEFAULT_GRID_SIZE,
  GRID_CLASSES,
  GRID_SIZE_OPTIONS,
  normalizeGridSize,
} from "./grid-size"
import { TIERS, groupByTier, tierOf } from "./tiers"
import type { EntryView } from "./types"

/** Só o que o tier list lê de um item. */
function rated(id: string, rating: number | null): EntryView {
  return { id, name: id, rating } as EntryView
}

// ---------------------------------------------------------------------------
// tamanho da grade
// ---------------------------------------------------------------------------

describe("tamanho da grade", () => {
  it("aceita os três tamanhos", () => {
    expect(normalizeGridSize("small")).toBe("small")
    expect(normalizeGridSize("medium")).toBe("medium")
    expect(normalizeGridSize("large")).toBe("large")
  })

  it("cai em Média com qualquer outra coisa", () => {
    expect(DEFAULT_GRID_SIZE).toBe("medium")
    expect(normalizeGridSize(null)).toBe("medium")
    expect(normalizeGridSize(undefined)).toBe("medium")
    expect(normalizeGridSize("")).toBe("medium")
    expect(normalizeGridSize("Large")).toBe("medium")
    expect(normalizeGridSize("grid")).toBe("medium")
    expect(normalizeGridSize(2)).toBe("medium")
    expect(normalizeGridSize({ size: "small" })).toBe("medium")
  })

  it("Média é exatamente a grade de antes", () => {
    expect(GRID_CLASSES.medium).toBe("grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4")
  })

  it("tem uma opção por tamanho, na ordem P, M, G", () => {
    expect(GRID_SIZE_OPTIONS.map((option) => option.letter)).toEqual(["P", "M", "G"])
    expect(GRID_SIZE_OPTIONS.map((option) => option.label)).toEqual(["Pequena", "Média", "Grande"])
  })
})

// ---------------------------------------------------------------------------
// tier list
// ---------------------------------------------------------------------------

describe("tier list", () => {
  it("põe cada nota na fileira certa, nas bordas", () => {
    expect(tierOf(5)).toBe("S")
    expect(tierOf(4.5)).toBe("A")
    expect(tierOf(4)).toBe("A")
    expect(tierOf(3.5)).toBe("B")
    expect(tierOf(3)).toBe("B")
    expect(tierOf(2.5)).toBe("C")
    expect(tierOf(2)).toBe("C")
    expect(tierOf(1.5)).toBe("D")
    expect(tierOf(1)).toBe("D")
    expect(tierOf(0.5)).toBe("E")
    expect(tierOf(0)).toBe("E")
  })

  it("deixa de fora quem não tem nota", () => {
    expect(tierOf(null)).toBeNull()
    expect(tierOf(undefined)).toBeNull()
    expect(tierOf(Number.NaN)).toBeNull()
    expect(tierOf(-1)).toBeNull()
  })

  it("tem as seis fileiras, de S a E, com as cores do Tier Maker", () => {
    expect(TIERS.map((tier) => tier.id)).toEqual(["S", "A", "B", "C", "D", "E"])
    expect(TIERS.map((tier) => tier.color)).toEqual([
      "#FF7F7F",
      "#FFBF7F",
      "#FFDF7F",
      "#FFFF7F",
      "#BFFF7F",
      "#7FFF7F",
    ])
  })

  it("agrupa mantendo a ordem de entrada e conta os sem nota", () => {
    const views = [
      rated("a", 4),
      rated("b", null),
      rated("c", 5),
      rated("d", 4.5),
      rated("e", 0.5),
      rated("f", 3.5),
      rated("g", null),
    ]
    const { rows, unrated } = groupByTier(views)

    expect(rows.map((row) => row.tier.id)).toEqual(["S", "A", "B", "C", "D", "E"])
    const ids = Object.fromEntries(
      rows.map((row) => [row.tier.id, row.views.map((view) => view.id)])
    )
    expect(ids).toEqual({ S: ["c"], A: ["a", "d"], B: ["f"], C: [], D: [], E: ["e"] })
    expect(unrated).toBe(2)
  })

  it("devolve as seis fileiras vazias quando não há nada", () => {
    const { rows, unrated } = groupByTier([])
    expect(rows).toHaveLength(6)
    expect(rows.every((row) => row.views.length === 0)).toBe(true)
    expect(unrated).toBe(0)
  })
})
