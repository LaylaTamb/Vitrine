import { describe, expect, it } from "vitest"

import {
  geminiPrompt,
  newSuggestions,
  parseFieldSuggestions,
  parseGeminiResponse,
  suggestionToField,
} from "./field-suggestions"

describe("sugestões de campos", () => {
  it("confere cada sugestão", () => {
    expect(
      parseFieldSuggestions([
        { nome: " Uva ", tipo: "str", owners: 5 },
        { nome: "uva", tipo: "str" },
        { nome: "Nome", tipo: "str" },
        { nome: "Avaliação", tipo: "star" },
        { nome: "Tipo", tipo: "select", opcoes: ["Tinto", "tinto", " Branco ", ""] },
        { nome: "Sem opções", tipo: "select", opcoes: [] },
        { nome: "Preço", tipo: "currency", moeda: "US$" },
        { nome: "Custo", tipo: "currency", moeda: "dobrão" },
        { nome: "Estranho", tipo: "cor" },
        null,
      ])
    ).toEqual([
      { nome: "Uva", tipo: "str", owners: 5 },
      { nome: "Tipo", tipo: "select", opcoes: ["Tinto", "Branco"] },
      { nome: "Preço", tipo: "currency", moeda: "$" },
      { nome: "Custo", tipo: "currency", moeda: "R$" },
    ])
    expect(parseFieldSuggestions("x")).toEqual([])
  })

  it("tira o que já está na categoria e traz com id novo", () => {
    const suggestions = parseFieldSuggestions([
      { nome: "Uva", tipo: "str" },
      { nome: "Safra", tipo: "int" },
    ])
    expect(newSuggestions(suggestions, [{ id: "f_1", nome: "UVA", tipo: "str" }])).toEqual([
      { nome: "Safra", tipo: "int" },
    ])

    const field = suggestionToField({ nome: "Tipo", tipo: "select", opcoes: ["Tinto"] })
    expect(field.id).toMatch(/^f_/)
    expect(field).toMatchObject({ nome: "Tipo", tipo: "select", opcoes: ["Tinto"] })
    expect(suggestionToField({ nome: "Preço", tipo: "currency" }).moeda).toBe("R$")
  })
})

describe("pedido à IA", () => {
  it("leva só o nome da categoria", () => {
    const prompt = geminiPrompt("  Vinhos  ")
    expect(prompt).toContain('"Vinhos"')
    expect(prompt).not.toContain("  Vinhos")
  })

  it("lê a resposta do Gemini e descarta o que não fecha", () => {
    const json = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  fields: [
                    { nome: "Uva", tipo: "str" },
                    { nome: "Corpo", tipo: "select", opcoes: ["Leve", "Médio", "Encorpado"] },
                    { nome: "Nota", tipo: "inventado" },
                  ],
                }),
              },
            ],
          },
        },
      ],
    }
    expect(parseGeminiResponse(json)).toEqual([
      { nome: "Uva", tipo: "str" },
      { nome: "Corpo", tipo: "select", opcoes: ["Leve", "Médio", "Encorpado"] },
    ])
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "não é json" }] } }] }))
      .toEqual([])
    expect(parseGeminiResponse(null)).toEqual([])
  })
})
