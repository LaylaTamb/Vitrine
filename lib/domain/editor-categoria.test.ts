import { describe, expect, it } from "vitest"

import {
  FIELD_TYPE_EXAMPLES,
  FIELD_TYPE_ORDER,
  FIELD_TYPE_SHORT_LABELS,
  guessFieldType,
} from "./fields"
import { SORT_KEYS, SORT_SHORT_LABELS } from "./filter"
import { colorLabel } from "./tags"
import { FIELD_TYPES } from "./types"

describe("editor de categoria", () => {
  it("adivinha o tipo pelo nome do campo", () => {
    const cases: [string, string][] = [
      ["Preço médio", "currency"],
      ["Valor", "currency"],
      ["Endereço", "location"],
      ["Cidade", "location"],
      ["Tempo de espera", "time"],
      ["Duração", "time"],
      ["Atendimento", "star"],
      ["Nota do ambiente", "star"],
      ["Ano", "int"],
      ["Safra", "int"],
      ["Temporadas", "int"],
      ["Teor alcoólico", "decimal"],
      ["Distância (km)", "decimal"],
      ["Gênero", "select"],
      ["Modo", "select"],
      ["Quando fui", "date"],
      ["Data da visita", "date"],
      ["Assisti em", "date"],
      ["Diretor", "str"],
      ["Anotações", "str"],
      ["", "str"],
    ]
    for (const [nome, tipo] of cases) expect([nome, guessFieldType(nome)]).toEqual([nome, tipo])
  })

  it("tem botão, nome curto e exemplo para todo tipo", () => {
    expect([...FIELD_TYPE_ORDER].sort()).toEqual([...FIELD_TYPES].sort())
    for (const tipo of FIELD_TYPES) {
      expect(FIELD_TYPE_SHORT_LABELS[tipo]).toBeTruthy()
      expect(FIELD_TYPE_EXAMPLES[tipo]).toBeTruthy()
    }
  })

  it("resume a cor e a ordem em palavras", () => {
    expect(colorLabel(null)).toBe("Sem cor")
    expect(colorLabel("#d6c08a")).toBe("Ocre")
    expect(colorLabel("#123456")).toBe("Cor própria")
    for (const key of SORT_KEYS) expect(SORT_SHORT_LABELS[key]).toBeTruthy()
  })
})
