import { describe, expect, it } from "vitest"

import { migrateCustomFields, moveSummary } from "./migrate"
import type { Estrutura } from "./types"

describe("trocar de categoria: o mesmo campo", () => {
  // Duas categorias vindas do mesmo modelo: os ids são os mesmos, mesmo que
  // a pessoa tenha renomeado um campo numa delas.
  const origem: Estrutura = [
    { id: "f_autor1", nome: "Autor", tipo: "str" },
    { id: "f_pag001", nome: "Páginas", tipo: "int" },
    { id: "f_lido01", nome: "Lido em", tipo: "date" },
  ]

  it("mantém pelo mesmo id e mesmo tipo, mesmo com outro nome", () => {
    const destino: Estrutura = [{ id: "f_autor1", nome: "Escritor(a)", tipo: "str" }]
    const result = migrateCustomFields(origem, destino, { f_autor1: "Clarice" })
    expect(result.values).toEqual({ f_autor1: "Clarice" })
    expect(result.fieldMap).toEqual({ f_autor1: "f_autor1" })
  })

  it("mesmo id com outro tipo não vale; nome e tipo iguais ainda valem", () => {
    const destino: Estrutura = [
      { id: "f_pag001", nome: "Páginas", tipo: "str" },
      { id: "f_outro1", nome: "Páginas", tipo: "int" },
    ]
    // dois campos com o mesmo nome no destino: vale o de mesmo tipo
    const result = migrateCustomFields(origem, destino, { f_pag001: 320 })
    expect(result.values).toEqual({ f_outro1: 320 })
  })

  it("nome igual com tipo diferente fica em branco", () => {
    const destino: Estrutura = [{ id: "d1", nome: "Lido em", tipo: "str" }]
    const result = migrateCustomFields(origem, destino, { f_lido01: "2026-10-01" })
    expect(result.values).toEqual({})
    expect(result.dropped).toBe(1)
  })

  it("o id tem a vez: cada campo do destino recebe um valor só", () => {
    const destino: Estrutura = [{ id: "f_autor1", nome: "Autor", tipo: "str" }]
    const outraOrigem: Estrutura = [
      { id: "x_autor", nome: "Autor", tipo: "str" }, // casaria pelo nome…
      { id: "f_autor1", nome: "Autoria", tipo: "str" }, // …mas este é o mesmo campo
    ]
    const result = migrateCustomFields(outraOrigem, destino, {
      x_autor: "Pelo nome",
      f_autor1: "Pelo id",
    })
    expect(result.values).toEqual({ f_autor1: "Pelo id" })
    expect(result.kept).toBe(1)
    expect(result.dropped).toBe(1)
  })
})

describe("resumo do diálogo de mover", () => {
  const origem: Estrutura = [
    { id: "a", nome: "Autor", tipo: "str" },
    { id: "b", nome: "Páginas", tipo: "int" },
    { id: "c", nome: "Editora", tipo: "str" },
  ]
  const destino: Estrutura = [{ id: "z", nome: "autor", tipo: "str" }]

  it("diz quais campos preenchidos vão junto e quais ficam", () => {
    const summary = moveSummary(origem, destino, { a: "Clarice", b: 320, c: "" }, 4.5, true)
    expect(summary.kept.map((field) => field.nome)).toEqual(["Autor"])
    expect(summary.dropped.map((field) => field.nome)).toEqual(["Páginas"])
    expect(summary.ratingLost).toBe(false)
  })

  it("a nota some quando o destino não usa estrelas", () => {
    expect(moveSummary(origem, destino, {}, 4, false).ratingLost).toBe(true)
    expect(moveSummary(origem, destino, {}, null, false).ratingLost).toBe(false)
  })
})
