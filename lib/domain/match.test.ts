import { describe, expect, it } from "vitest"

import {
  isMatchCategory,
  matchLocation,
  matchOrigin,
  matchPeopleLabel,
  matchState,
  matchStatusText,
  parseMatches,
  waitingFor,
  type MatchView,
} from "./match"

const ME = "u-me"

const raw = [
  {
    id: "m1",
    status: "pending",
    created_at: "2026-10-20T12:00:00Z",
    created_by: "u-ana",
    match_members: [
      { user_id: "u-bruno", status: "invited", color: "#8FC9A6", position: 2, profile: { username: "bruno" } },
      { user_id: "u-ana", status: "accepted", color: "#B98CC2", position: 0, profile: { username: "ana", display_name: "Ana" } },
      { user_id: ME, status: "invited", color: "#8FB3C9", position: 1, profile: { username: "eu" } },
      { user_id: "u-x", status: "estranho", profile: { username: "x" } },
    ],
  },
  { id: "m2", status: "inventado", created_by: "u-ana" },
]

describe("matches", () => {
  it("lê os matches com as pessoas na ordem de entrada", () => {
    const [match, ...rest] = parseMatches(raw)
    expect(rest).toEqual([])
    expect(match.members.map((member) => member.username)).toEqual(["ana", "eu", "bruno"])
    expect(match.members[0]).toMatchObject({ displayName: "Ana", color: "#B98CC2" })
  })

  it("diz o que falta, do ponto de vista de quem vê", () => {
    const [match] = parseMatches(raw)
    expect(matchPeopleLabel(match, ME)).toBe("@ana, @bruno e você")
    expect(matchState(match, ME)).toBe("answer")
    expect(matchStatusText(match, ME)).toBe("Convite para você: aceite para comparar as coleções.")
    expect(matchState(match, "u-ana")).toBe("waiting")
    expect(matchStatusText(match, "u-ana")).toBe("Esperando @eu, @bruno aceitarem.")
    expect(waitingFor(match).map((member) => member.username)).toEqual(["eu", "bruno"])
  })

  it("pronto e cancelado", () => {
    const [match] = parseMatches(raw)
    const ready: MatchView = { ...match, status: "ready" }
    expect(matchStatusText(ready, ME)).toBe("Todo mundo aceitou: o match está pronto.")
    const canceled: MatchView = {
      ...match,
      status: "canceled",
      members: match.members.map((member) =>
        member.username === "bruno" ? { ...member, status: "declined" } : member
      ),
    }
    expect(matchStatusText(canceled, ME)).toBe("@bruno recusou, e o match foi cancelado.")
  })
})

describe("o Trazer e as cópias antigas", () => {
  it("os campos do original, formatados e só os preenchidos", () => {
    const origin = matchOrigin(
      {
        category: "Restaurantes",
        estrutura: [
          { id: "f1", nome: "Bairro", tipo: "str" },
          { id: "f2", nome: "Preço", tipo: "currency", moeda: "R$" },
          { id: "f3", nome: "Vazio", tipo: "str" },
        ],
        values: { f1: "Pinheiros", f2: 80 },
      },
      (field, value) => (field.tipo === "currency" ? `R$ ${value}` : String(value))
    )
    expect(origin).toEqual({
      category: "Restaurantes",
      fields: [
        { id: "f1", label: "Bairro", value: "Pinheiros", tipo: "str" },
        { id: "f2", label: "Preço", value: "R$ 80", tipo: "currency" },
      ],
    })
    expect(matchLocation(origin)).toBeNull()
  })

  it("a localização que o Trazer leva", () => {
    const origin = matchOrigin(
      {
        estrutura: [{ id: "loc", nome: "Endereço", tipo: "location" }],
        values: { loc: "Rua A, 1" },
      },
      (_field, value) => String(value)
    )
    expect(matchLocation(origin)).toEqual({ fieldId: "loc", address: "Rua A, 1" })
    expect(origin.category).toBeNull()
  })

  it("reconhece a categoria da cópia", () => {
    expect(isMatchCategory({ kind: "match" })).toBe(true)
    expect(isMatchCategory({ kind: "inbox" })).toBe(false)
    expect(isMatchCategory(null)).toBe(false)
  })
})
