import { describe, expect, it } from "vitest"

import { EMPTY_CATEGORY_FILTER } from "./filter"
import {
  fitSlots,
  STORY_BODY,
  STORY_GRID,
  STORY_LIST,
  STORY_TIER,
  storyFileName,
  storyFilterChips,
  storyGridCell,
  storyHref,
  storyItems,
  storyModeOf,
  storyPlan,
  storyTierRows,
  storyTierThumb,
} from "./list-story"
import { framedBox } from "./remote-image"
import type { EntryView } from "./types"

const item = (id: string, rating: number | null) => ({ id, rating }) as EntryView
const many = (count: number, rating: number | null = 4) =>
  Array.from({ length: count }, (_, index) => item(`i${index}`, rating))

describe("imagem da lista", () => {
  it("escolhe o modo, e o tier list só com estrelas", () => {
    expect(storyModeOf("list", true)).toBe("list")
    expect(storyModeOf("tier", true)).toBe("tier")
    expect(storyModeOf("tier", false)).toBe("grid")
    expect(storyModeOf(undefined, true)).toBe("grid")
    expect(storyModeOf("qualquer", true)).toBe("grid")
  })

  it("cabendo, mostra tudo; senão, o último lugar vira +N", () => {
    expect(fitSlots([1, 2, 3], 4)).toEqual({ shown: [1, 2, 3], more: 0 })
    expect(fitSlots([1, 2, 3, 4], 4)).toEqual({ shown: [1, 2, 3, 4], more: 0 })
    expect(fitSlots([1, 2, 3, 4, 5], 4)).toEqual({ shown: [1, 2, 3], more: 2 })
  })

  it("a grade é 2×2, 3×3 ou 4×4, e as fotos cabem no espaço", () => {
    const plan = storyPlan("grid", "medium", many(20))
    expect(plan.mode === "grid" && [plan.shown.length, plan.more]).toEqual([8, 12])
    expect(storyItems(storyPlan("grid", "large", many(3)))).toHaveLength(3)
    for (const size of ["small", "medium", "large"] as const) {
      const { cols, rows, gap, name } = STORY_GRID[size]
      const cell = storyGridCell(size)
      expect(cols * cell + gap * (cols - 1)).toBeLessThanOrEqual(STORY_BODY.width)
      expect(rows * (cell + name) + gap * (rows - 1)).toBeLessThanOrEqual(STORY_BODY.height)
    }
  })

  it("a lista cabe no espaço, com a linha do +N", () => {
    const { rows, height, gap } = STORY_LIST
    expect(rows * height + gap * (rows - 1)).toBeLessThanOrEqual(STORY_BODY.height)
    const plan = storyPlan("list", "small", many(30))
    expect(plan.mode === "list" && [plan.shown.length, plan.more]).toEqual([7, 23])
  })

  it("o tier list mostra só as fileiras com itens, e a Sem nota no fim", () => {
    const rows = storyTierRows(
      [item("a", 5), item("b", 3), item("c", null), item("d", 5), item("e", 3.5)],
      "medium"
    )
    expect(rows.map((row) => row.tier?.id ?? "sem")).toEqual(["S", "B", "sem"])
    expect(rows[0].shown.map((view) => view.id)).toEqual(["a", "d"])
    const full = storyTierRows(many(10, 4), "large")
    expect([full[0].shown.length, full[0].more]).toEqual([3, 7])
  })

  it("as miniaturas do tier list cabem na largura e na altura", () => {
    for (const size of ["small", "medium", "large"] as const) {
      for (const count of [1, 3, 7]) {
        const thumb = storyTierThumb(size, count)
        const per = STORY_TIER.perRow[size]
        const { label, gap, pad, thumbGap } = STORY_TIER
        expect(label + gap + pad * 2 + per * thumb + thumbGap * (per - 1)).toBeLessThanOrEqual(
          STORY_BODY.width
        )
        expect(count * (thumb + pad * 2) + gap * (count - 1)).toBeLessThanOrEqual(STORY_BODY.height)
      }
    }
  })

  it("descreve o filtro em palavras curtas", () => {
    const tags = [
      { id: "t1", name: "favorito" },
      { id: "t2", name: "rever" },
      { id: "t3", name: "barato" },
      { id: "t4", name: "perto" },
    ]
    expect(storyFilterChips(EMPTY_CATEGORY_FILTER, tags, true)).toEqual([])
    expect(
      storyFilterChips(
        { query: " café ", minRating: "4", maxRating: "", tagIds: ["t1", "t2", "t3", "t4"] },
        tags,
        true
      )
    ).toEqual(["“café”", "nota 4 ou mais", "#favorito", "#rever", "#barato", "+1 tags"])
    expect(
      storyFilterChips({ query: "", minRating: "3", maxRating: "4,5", tagIds: [] }, tags, true)
    ).toEqual(["nota 3 a 4,5"])
    expect(
      storyFilterChips({ query: "", minRating: "", maxRating: "2", tagIds: [] }, tags, false)
    ).toEqual([])
  })

  it("monta o endereço da imagem com o que está na tela", () => {
    const base = { mode: "grid" as const, size: "medium" as const, defaultSort: "recent" as const }
    expect(
      storyHref("c1", {
        ...base,
        folderId: null,
        filter: { ...EMPTY_CATEGORY_FILTER, sort: "recent" },
      })
    ).toBe("/categoria/c1/story?vista=grid&tamanho=medium")
    const href = storyHref("c1", {
      ...base,
      mode: "tier",
      size: "small",
      folderId: "f9",
      filter: {
        query: " café ",
        minRating: "4",
        maxRating: "",
        tagIds: ["t1", "t2"],
        mode: "or",
        sort: "name_asc",
      },
    })
    const params = new URL(href, "https://x.test").searchParams
    expect(Object.fromEntries(params)).toEqual({
      vista: "tier",
      tamanho: "small",
      pasta: "f9",
      q: "café",
      min: "4",
      tags: "t1,t2",
      modo: "or",
      ordem: "name_asc",
    })
  })

  it("dá um nome de arquivo sem acento nem espaço", () => {
    expect(storyFileName("Cafés de SP!")).toBe("vitrine-cafes-de-sp.png")
    expect(storyFileName("☕")).toBe("vitrine-lista.png")
  })

  it("recorta a foto com o enquadramento do item (x, y e zoom)", () => {
    const wide = { width: 200, height: 100 }
    const box = { width: 100, height: 100 }
    expect(framedBox(wide, box, { x: 50, y: 50, zoom: 1 })).toEqual({
      width: 200,
      height: 100,
      left: -50,
      top: 0,
    })
    expect(framedBox(wide, box, { x: 0, y: 50, zoom: 1 }).left).toBe(0)
    expect(framedBox(wide, box, { x: 100, y: 50, zoom: 1 }).left).toBe(-100)
    // Com zoom 2 no meio, o centro da imagem continua no centro da caixa.
    const zoomed = framedBox(wide, box, { x: 50, y: 50, zoom: 2 })
    expect(zoomed).toEqual({ width: 400, height: 200, left: -150, top: -50 })
  })
})
