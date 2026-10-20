import { describe, expect, it } from "vitest"

import {
  copySummary,
  linkChanged,
  linkNews,
  parseExploreResults,
  parseLinkSync,
  takeLabel,
} from "./explore"

describe("Explorar", () => {
  it("lê as categorias, preservando os ids dos campos", () => {
    const [category] = parseExploreResults([
      {
        id: "c1",
        name: "Bares",
        icon: "🍺",
        estrutura: [{ id: "f_bairro", nome: "Bairro", tipo: "str" }],
        rating_enabled: true,
        owner: { username: "ana" },
        total: 42,
        uses: 3,
        preview: [{ name: "Bar do Zé", rating: 5 }, { name: "" }, { name: "Boteco", rating: null }],
      },
      { id: "c2", name: "Sem dono" },
    ])
    expect(category.estrutura[0].id).toBe("f_bairro")
    expect(category.total).toBe(42)
    expect(category.preview).toEqual([
      { name: "Bar do Zé", rating: 5 },
      { name: "Boteco", rating: null },
    ])
    expect(parseExploreResults(null)).toEqual([])
  })

  it("avisa quando passa de 500", () => {
    expect(takeLabel(120)).toBe("Pegar com itens")
    expect(takeLabel(812)).toBe("Pegar os primeiros 500")
    expect(copySummary(12, 12)).toBe("12 itens vieram junto.")
    expect(copySummary(500, 812)).toBe(
      "Vieram os primeiros 500 de 812 itens. Os outros chegam aos poucos, a cada vez que você abrir a categoria."
    )
  })
})

describe("cópia ligada", () => {
  it("lê a sincronização e diz o que chegou", () => {
    const sync = parseLinkSync({ status: "synced", author: "ana", added: 2, updated: 1, removed: 1 })
    expect(linkChanged(sync)).toBe(true)
    expect(linkNews(sync)).toBe(
      "Novidades de @ana: 2 itens novos, 1 item atualizado, 1 item removido do original."
    )
  })

  it("nada mudou: sem recado", () => {
    const fresh = parseLinkSync({ status: "fresh", author: "ana" })
    expect(linkChanged(fresh)).toBe(false)
    expect(linkNews(fresh)).toBeNull()
    expect(linkNews(parseLinkSync({ status: "synced", author: "ana" }))).toBeNull()
  })

  it("desligada pelo banco conta como mudança; resposta estranha não", () => {
    expect(linkChanged(parseLinkSync({ status: "unlinked" }))).toBe(true)
    expect(parseLinkSync("x")).toEqual({
      status: "not_linked",
      author: null,
      added: 0,
      updated: 0,
      removed: 0,
    })
  })
})
