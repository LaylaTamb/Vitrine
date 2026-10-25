import { describe, expect, it } from "vitest"

import { feedAction, feedPeople, groupFeed, parseFeedRows } from "./feed"

const ana = { id: "u-ana", username: "ana", display_name: "Ana", avatar_url: null }
const bia = { id: "u-bia", username: "bia", display_name: null, avatar_url: null }
const cafes = { id: "c-cafes", name: "Cafés", icon: "☕", rating_enabled: true }
const filmes = { id: "c-filmes", name: "Filmes", icon: "🎬", rating_enabled: false }

function row(
  id: string,
  createdAt: string,
  owner: Record<string, unknown> = ana,
  category: Record<string, unknown> = cafes,
  rating: unknown = 4
) {
  return { id, name: `Item ${id}`, rating, image_url: null, created_at: createdAt, owner, category }
}

describe("feed do Início", () => {
  it("confere as linhas e pula as que vêm sem dono ou sem categoria", () => {
    const entries = parseFeedRows([
      row("e1", "2026-10-24T12:00:00Z", ana, cafes, "4.5"),
      { ...row("e2", "2026-10-24T11:00:00Z"), owner: null },
      { ...row("e3", "2026-10-24T10:00:00Z"), category: [] },
      row("e4", "2026-10-24T09:00:00Z", bia, filmes, 0),
    ])
    expect(entries.map((entry) => entry.id)).toEqual(["e1", "e4"])
    expect(entries[0].rating).toBe(4.5)
    expect(entries[1].rating).toBeNull()
    expect(entries[1].category.ratingEnabled).toBe(false)
    expect(parseFeedRows(null)).toEqual([])
  })

  it("junta pessoa + categoria + dia (de São Paulo), do mais novo para o mais velho", () => {
    const entries = parseFeedRows([
      row("a1", "2026-10-24T15:00:00Z"),
      row("a2", "2026-10-24T13:00:00Z"),
      // 01:00 UTC do dia 24 ainda é dia 23 em São Paulo
      row("a3", "2026-10-24T01:00:00Z"),
      row("b1", "2026-10-24T14:00:00Z", bia),
      row("a4", "2026-10-24T12:00:00Z", ana, filmes),
    ])
    const groups = groupFeed(entries)
    expect(groups.map((group) => group.entries.map((entry) => entry.id))).toEqual([
      ["a1", "a2"],
      ["b1"],
      ["a4"],
      ["a3"],
    ])
    expect(groups[0].latestAt).toBe("2026-10-24T15:00:00Z")
    expect(feedPeople(groups).map((person) => person.username)).toEqual(["ana", "bia"])
  })

  it("a frase do cartão", () => {
    expect(feedAction(1)).toBe("adicionou em")
    expect(feedAction(5)).toBe("adicionou 5 itens em")
  })
})
