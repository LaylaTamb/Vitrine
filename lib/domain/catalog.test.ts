import { describe, expect, it } from "vitest"

import { normalizeTitle, sameTitle } from "./catalog"

describe("título normalizado", () => {
  it("minúsculas, sem acento e sem pontuação", () => {
    expect(normalizeTitle("Pão de Açúcar!")).toBe("pao de acucar")
    expect(normalizeTitle("  Café   Girondino ")).toBe("cafe girondino")
    expect(normalizeTitle("Tom & Jerry: O Filme")).toBe("tom jerry o filme")
    expect(normalizeTitle("Star Wars – Episódio IV")).toBe("star wars episodio iv")
  })

  it("tira um artigo do começo, em várias línguas", () => {
    expect(normalizeTitle("O Poderoso Chefão")).toBe("poderoso chefao")
    expect(normalizeTitle("A Origem")).toBe("origem")
    expect(normalizeTitle("The Matrix")).toBe("matrix")
    expect(normalizeTitle("Os Miseráveis")).toBe("miseraveis")
    expect(normalizeTitle("El Laberinto del Fauno")).toBe("laberinto del fauno")
    // só o primeiro, e só no começo
    expect(normalizeTitle("O Senhor dos Anéis: A Sociedade do Anel")).toBe(
      "senhor dos aneis a sociedade do anel"
    )
  })

  it("título que é só o artigo, ou só número, fica", () => {
    expect(normalizeTitle("A")).toBe("a")
    expect(normalizeTitle("1984")).toBe("1984")
    expect(normalizeTitle("It")).toBe("it")
  })

  it("apóstrofo junta as partes", () => {
    expect(normalizeTitle("L'Auberge Espagnole")).toBe("lauberge espagnole")
    expect(normalizeTitle("Olho d’Água")).toBe("olho dagua")
  })

  it("compara dois títulos", () => {
    expect(sameTitle("O Poderoso Chefão", "poderoso chefao")).toBe(true)
    expect(sameTitle("The Matrix", "Matrix")).toBe(true)
    expect(sameTitle("Matrix", "Matrix Reloaded")).toBe(false)
    expect(sameTitle("", "")).toBe(false)
    expect(sameTitle("!!!", "???")).toBe(false)
  })
})
