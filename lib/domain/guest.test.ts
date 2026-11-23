import { describe, expect, it } from "vitest"

import { inviteCopy, isGuestBlocked, parsePublicFollows, parsePublicPeople } from "./guest"

describe("modo visitante", () => {
  it("lê as pessoas com lista Pública e descarta o que vier estranho", () => {
    expect(
      parsePublicPeople([
        { id: "p1", username: "ana", display_name: "Ana", avatar_url: null, lists: 3 },
        {
          id: "p2",
          username: "bia",
          display_name: "",
          avatar_url: "https://x.test/a.png",
          lists: "2",
        },
        { id: "p3", username: "" },
        null,
        { username: "sem-id" },
      ])
    ).toEqual([
      { id: "p1", username: "ana", display_name: "Ana", avatar_url: null, lists: 3 },
      {
        id: "p2",
        username: "bia",
        display_name: null,
        avatar_url: "https://x.test/a.png",
        lists: 2,
      },
    ])
    expect(parsePublicPeople(null)).toEqual([])
  })

  it("lê seguidores e seguindo, com a lista escondida quando não há nada Público", () => {
    expect(parsePublicFollows(null)).toBeNull()
    expect(
      parsePublicFollows({
        followers: 12,
        following: "4",
        hidden: false,
        people: [{ id: "p1", username: "ana" }, { id: "x" }],
      })
    ).toEqual({
      followers: 12,
      following: 4,
      hidden: false,
      people: [{ id: "p1", username: "ana", display_name: null, avatar_url: null }],
    })
    expect(parsePublicFollows({ followers: -1, hidden: true, people: "?" })).toEqual({
      followers: 0,
      following: 0,
      hidden: true,
      people: [],
    })
  })

  it("reconhece o Explorar fechado para quem não tem conta (antes do 50)", () => {
    expect(isGuestBlocked({ code: "42501", message: "É preciso entrar na conta." })).toBe(true)
    expect(isGuestBlocked({ code: "PGRST202" })).toBe(false)
    expect(isGuestBlocked(null)).toBe(false)
  })
})

describe("janela de convite", () => {
  it("diz qual ação pede a conta, com a pessoa pelo @", () => {
    expect(inviteCopy({ kind: "follow", username: "ana" }).title).toBe(
      "Crie sua conta para seguir @ana"
    )
    expect(inviteCopy({ kind: "take", name: "Cafés de SP" }).title).toBe(
      "Crie sua conta para pegar “Cafés de SP”"
    )
    for (const kind of ["signup", "add", "match", "map"] as const) {
      const copy = inviteCopy({ kind })
      expect(copy.title).toMatch(/^Crie sua conta/)
      expect(copy.text).toBeTruthy()
      expect(copy.icon).toBeTruthy()
    }
  })
})
