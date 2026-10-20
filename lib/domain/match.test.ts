import { describe, expect, it } from "vitest"

import {
  applyMatchFilter,
  compatibility,
  decorateMatchCopy,
  groupCompat,
  isMatchCategory,
  matchLocation,
  matchMarks,
  matchOrigin,
  matchPeopleLabel,
  matchState,
  matchStatusText,
  parseMatches,
  suggestionText,
  waitingFor,
  type MatchItem,
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

describe("a cópia: marcações e compatibilidade", () => {
  const A = "a"
  const B = "b"
  const C = "c"
  const items: MatchItem[] = [
    { id: "1", ownerId: A, key: "t:filme|duna", rating: 5 },
    { id: "2", ownerId: B, key: "t:filme|duna", rating: 4 },
    { id: "3", ownerId: A, key: "lugar:42", rating: 4.5 },
    { id: "4", ownerId: B, key: "t:filme|aftersun", rating: 3 },
    { id: "5", ownerId: C, key: "t:livro|torto arado", rating: null },
  ]

  it("em comum (2+ pessoas) e sugestão (nota ≥ 4, quem não tem)", () => {
    const marks = matchMarks(items, [A, B, C])
    expect(marks.get("1")).toEqual({ common: true, suggestionFor: [C] })
    expect(marks.get("3")).toEqual({ common: false, suggestionFor: [B, C] })
    expect(marks.get("4")).toEqual({ common: false, suggestionFor: [] })
    expect(marks.get("5")).toEqual({ common: false, suggestionFor: [] })
  })

  it("a fórmula do plano: 100 e 40 itens, 8 em comum, meia estrela de diferença → 77%", () => {
    // sobreposição = 8 ÷ (25% de 40 = 10) = 0,8; concordância = 1 − 0,5 ÷ 5 = 0,9
    const value = compatibility({ sizeA: 100, sizeB: 40, common: 8, agreement: 0.9 })
    expect(value).toBeCloseTo(0.768, 5)
    expect(Math.round(value * 100)).toBe(77)
  })

  it("teto, ninguém em comum e coleção vazia", () => {
    expect(compatibility({ sizeA: 10, sizeB: 8, common: 8, agreement: 1 })).toBe(1)
    expect(compatibility({ sizeA: 10, sizeB: 8, common: 0, agreement: 1 })).toBe(0)
    expect(compatibility({ sizeA: 0, sizeB: 8, common: 0, agreement: 1 })).toBe(0)
  })

  it("pares e grupo a partir dos itens", () => {
    const { group, pairs } = groupCompat(items, [A, B, C])
    // A × B: 1 em comum de 2 cada (25% de 2 = 0,5 → piso 1) → sobreposição 1;
    // concordância 1 − |5 − 4| ÷ 5 = 0,8 → 1 × (0,6 + 0,32) = 92%.
    expect(pairs.find((pair) => pair.a === A && pair.b === B)).toEqual({
      a: A,
      b: B,
      percent: 92,
      common: 1,
    })
    expect(pairs.find((pair) => pair.a === A && pair.b === C)?.percent).toBe(0)
    expect(group).toBe(31)
  })

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
})

describe("a cópia do ponto de vista de quem abre", () => {
  const [base] = parseMatches(raw)
  const match: MatchView = { ...base, status: "ready" }
  // você, @ana e @bruno; um item de quem saiu (conta excluída)
  const rows = [
    { id: "e1", rating: "4.5", match_owner_id: "u-ana", match_key: "t:filme|duna" },
    { id: "e2", rating: 3, match_owner_id: ME, match_key: "t:filme|duna" },
    { id: "e3", rating: 5, match_owner_id: "u-bruno", match_key: "lugar:9" },
    { id: "e4", rating: null, match_owner_id: null, match_key: null, match_color: "#123456" },
  ]

  it("legenda (você primeiro), marcações e totais", () => {
    const { info, byEntry } = decorateMatchCopy({ rows, match, meId: ME })
    expect(info.people.map((person) => person.label)).toEqual([
      "você",
      "@ana",
      "@bruno",
      "conta excluída",
    ])
    expect(info.people.map((person) => person.items)).toEqual([1, 1, 1, 1])
    expect(byEntry.get("e1")).toMatchObject({
      ownerLabel: "@ana",
      common: true,
      suggestionForMe: false,
      suggestionFor: ["@bruno"],
    })
    expect(byEntry.get("e3")).toMatchObject({
      isMine: false,
      suggestionForMe: true,
      suggestionFor: ["você", "@ana"],
      color: "#8FC9A6",
    })
    expect(byEntry.get("e2")).toMatchObject({ isMine: true, ownerLabel: "você", common: true })
    expect(info.totals).toEqual({ common: 2, suggestions: 1 })
    // os pares com você vêm primeiro, com você na frente do nome
    expect(info.pairs[0].label).toBe("você e @ana")
    expect(info.pairs.filter((pair) => pair.withMe)).toHaveLength(2)
  })

  it("filtros rápidos e por pessoa", () => {
    const { byEntry } = decorateMatchCopy({ rows, match, meId: ME })
    const views = rows.map((row) => ({ id: row.id, match: byEntry.get(row.id) }))
    const ids = (list: { id: string }[]) => list.map((view) => view.id)
    expect(ids(applyMatchFilter(views, { mode: "all", person: null }))).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
    ])
    expect(ids(applyMatchFilter(views, { mode: "common", person: null }))).toEqual(["e1", "e2"])
    expect(ids(applyMatchFilter(views, { mode: "suggestions", person: null }))).toEqual(["e3"])
    expect(ids(applyMatchFilter(views, { mode: "common", person: "u-ana" }))).toEqual(["e1"])
  })

  it("sem o match (sumiu do banco): as pessoas saem dos itens", () => {
    const { info } = decorateMatchCopy({ rows, match: null, meId: ME })
    expect(info.matchId).toBeNull()
    expect(info.people.map((person) => person.label)).toEqual([
      "você",
      "alguém",
      "alguém",
      "conta excluída",
    ])
  })

  it("a frase da sugestão", () => {
    expect(suggestionText({ suggestionFor: ["você"], suggestionForMe: true })).toBe(
      "Sugestão para você: tem nota 4 ou mais, e você ainda não tem."
    )
    expect(suggestionText({ suggestionFor: ["você", "@ana"], suggestionForMe: true })).toBe(
      "Sugestão para você, @ana: tem nota 4 ou mais, e vocês ainda não têm."
    )
    expect(suggestionText({ suggestionFor: ["@ana"], suggestionForMe: false })).toBe(
      "Sugestão para @ana: tem nota 4 ou mais, e @ana ainda não tem."
    )
    expect(suggestionText({ suggestionFor: [], suggestionForMe: false })).toBe("")
  })

  it("reconhece a categoria da cópia", () => {
    expect(isMatchCategory({ kind: "match" })).toBe(true)
    expect(isMatchCategory({ kind: "inbox" })).toBe(false)
    expect(isMatchCategory(null)).toBe(false)
  })
})
