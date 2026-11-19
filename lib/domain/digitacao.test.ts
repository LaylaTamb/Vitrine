import { describe, expect, it } from "vitest"

import { decimalInput, fieldInputValue, moneyInput } from "./fields"
import { formatMoney } from "./format"
import type { FieldDef } from "./types"
import { formatFieldValue } from "./view"

const numero: FieldDef = { id: "n", nome: "Km", tipo: "decimal" }
const preco: FieldDef = { id: "p", nome: "Preço", tipo: "currency", moeda: "R$" }

describe("digitação de Número e Moeda", () => {
  it("aceita só algarismos e uma vírgula, com até 2 casas", () => {
    const cases: [string, string][] = [
      ["12", "12"],
      ["12,5", "12,5"],
      ["1.500", "1500"],
      ["1.500,75", "1500,75"],
      ["1,2,3", "1,23"],
      ["3,14159", "3,14"],
      ["12a,b5", "12,5"],
      ["-4,5", "-4,5"],
      ["4-5", "45"],
      [",", ","],
      ["", ""],
    ]
    for (const [raw, shown] of cases) expect([raw, decimalInput(raw)]).toEqual([raw, shown])
  })

  it("completa os centavos da moeda ao sair do campo", () => {
    expect(moneyInput("50")).toBe("50,00")
    expect(moneyInput("12,5")).toBe("12,50")
    expect(moneyInput("1.500")).toBe("1500,00")
    expect(moneyInput("0,99")).toBe("0,99")
    expect(moneyInput(",5")).toBe("0,50")
    expect(moneyInput("")).toBe("")
    expect(moneyInput("-")).toBe("-")
  })

  it("abre o valor salvo com vírgula, e a moeda com os centavos", () => {
    expect(fieldInputValue(preco, 50)).toBe("50,00")
    expect(fieldInputValue(preco, 12.5)).toBe("12,50")
    expect(fieldInputValue(numero, 12.5)).toBe("12,5")
    expect(fieldInputValue(numero, 2024)).toBe("2024")
    expect(fieldInputValue(numero, -0.75)).toBe("-0,75")
    expect(fieldInputValue(undefined, 7)).toBe("7")
  })

  it("mostra a moeda sempre com os centavos", () => {
    expect(formatMoney(50)).toBe("50,00")
    expect(formatFieldValue(preco, 45)).toBe("R$ 45,00")
    expect(formatFieldValue(preco, 12.5)).toBe("R$ 12,50")
  })
})
