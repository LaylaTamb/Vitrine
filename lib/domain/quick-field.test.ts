import { describe, expect, it } from "vitest"

import { isMissingColumn } from "./errors"
import {
  normalizeQuickField,
  quickFieldOf,
  quickFieldOptions,
  QUICK_FIELD_NAME,
  QUICK_FIELD_RATING,
} from "./quick-field"
import type { Estrutura } from "./types"

const estrutura: Estrutura = [
  { id: "f_local1", nome: "Localização", tipo: "location" },
  { id: "f_autor1", nome: "Autor", tipo: "str" },
]

describe("campo principal", () => {
  it("sem escolha (ou antes da migração 19) é o Nome", () => {
    expect(quickFieldOf({ estrutura, rating_enabled: true })).toBe(QUICK_FIELD_NAME)
    expect(quickFieldOf({ estrutura, rating_enabled: true, quick_field: "name" })).toBe("name")
  })

  it("vale um campo que existe, ou as Estrelas ligadas", () => {
    expect(quickFieldOf({ estrutura, rating_enabled: true, quick_field: "f_autor1" })).toBe(
      "f_autor1"
    )
    expect(quickFieldOf({ estrutura, rating_enabled: true, quick_field: "rating" })).toBe(
      QUICK_FIELD_RATING
    )
  })

  it("campo removido ou estrelas desligadas voltam para o Nome", () => {
    expect(normalizeQuickField("f_sumiu", estrutura, true)).toBe(QUICK_FIELD_NAME)
    expect(normalizeQuickField("rating", estrutura, false)).toBe(QUICK_FIELD_NAME)
    expect(normalizeQuickField("", estrutura, true)).toBe(QUICK_FIELD_NAME)
    expect(normalizeQuickField(null, [], false)).toBe(QUICK_FIELD_NAME)
  })

  it("oferece Nome, Estrelas (se ligadas) e os campos, nessa ordem", () => {
    expect(quickFieldOptions(estrutura, true)).toEqual([
      { value: "name", label: "Só o Nome" },
      { value: "rating", label: "Estrelas (a nota)" },
      { value: "f_local1", label: "Localização · Localização (mapa)" },
      { value: "f_autor1", label: "Autor · Texto" },
    ])
    expect(quickFieldOptions(estrutura, false).map((option) => option.value)).toEqual([
      "name",
      "f_local1",
      "f_autor1",
    ])
  })

  it("campo de id 'name' ou 'rating' (importado à mão) não vira opção", () => {
    const importado: Estrutura = [{ id: "name", nome: "Nome alternativo", tipo: "str" }]
    expect(quickFieldOptions(importado, false).map((option) => option.value)).toEqual(["name"])
  })
})

describe("antes da migração 19", () => {
  it("reconhece qual coluna falta", () => {
    const error = {
      code: "PGRST204",
      message: "Could not find the 'quick_field' column of 'categories' in the schema cache",
    }
    expect(isMissingColumn(error)).toBe(true)
    expect(isMissingColumn(error, "quick_field")).toBe(true)
    expect(isMissingColumn(error, "visibility")).toBe(false)
  })
})
