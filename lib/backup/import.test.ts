import { describe, expect, it } from "vitest"

import { parseEstrutura } from "@/lib/domain/fields"

import { parseBackupJSON, positionsInLevel } from "./import"

function parse(payload: unknown) {
  const result = parseBackupJSON(JSON.stringify(payload))
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const category = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Restaurantes",
  ...extra,
})

describe("backup: visibilidade", () => {
  it("leva o nível de cada pasta e categoria", () => {
    const data = parse({
      folders: [
        { id: "p1", name: "Comidinhas", parentId: null, visibility: "friends" },
        { id: "p2", name: "Viagens", parentId: null, visibility: "private" },
      ],
      categories: [category({ folderId: "p1", visibility: "public" })],
    })
    expect(data.folders.map((folder) => folder.visibility)).toEqual(["friends", "private"])
    expect(data.categories[0].visibility).toBe("public")
  })

  it("arquivo antigo, sem nível, continua importando (fica o padrão do perfil)", () => {
    const data = parse({
      folders: [{ id: "p1", name: "Comidinhas", parentId: null }],
      categories: [category({ folderId: "p1" })],
    })
    expect(data.folders[0].visibility).toBeUndefined()
    expect(data.categories[0].visibility).toBeUndefined()
  })

  it("nível desconhecido não trava a importação", () => {
    const data = parse({
      folders: [{ id: "p1", name: "Comidinhas", parentId: null, visibility: "segredo" }],
      categories: [category({ visibility: 3 })],
    })
    expect(data.folders[0].visibility).toBeUndefined()
    expect(data.categories[0].visibility).toBeUndefined()
  })
})

describe("backup: moeda", () => {
  it("leva o símbolo da moeda de cada campo de dinheiro", () => {
    const data = parse({
      categories: [
        category({
          estrutura: [
            { id: "f1", nome: "Preço", tipo: "currency", moeda: "€" },
            { id: "f2", nome: "Gorjeta", tipo: "currency" },
            { id: "f3", nome: "Taxa", tipo: "currency", moeda: "BTC" },
          ],
        }),
      ],
    })
    const estrutura = parseEstrutura(data.categories[0].estrutura)
    // sem símbolo, ou com um fora da lista: o padrão, como no editor
    expect(estrutura.map((field) => field.moeda)).toEqual(["€", "R$", "R$"])
  })
})

describe("backup: ordem manual", () => {
  it("a posição de cada um dentro do próprio nível", () => {
    expect(
      positionsInLevel(["a", "b", "x", "c"], (item) => (item === "x" ? "pasta" : "raiz"))
    ).toEqual([0, 1, 0, 2])
  })
})
