import { describe, expect, it } from "vitest"

import { isSyncDue, letterboxdSummary } from "./connected"

describe("atualizar ao abrir a categoria", () => {
  const now = new Date("2026-10-22T12:00:00Z")

  it("nunca tentou, ou faz mais de 1 hora: atualiza", () => {
    expect(isSyncDue(null, now)).toBe(true)
    expect(isSyncDue("2026-10-22T10:59:00Z", now)).toBe(true)
    expect(isSyncDue("2026-10-22T11:00:00Z", now)).toBe(true)
    expect(isSyncDue("data estranha", now)).toBe(true)
  })

  it("tentou há menos de 1 hora: deixa", () => {
    expect(isSyncDue("2026-10-22T11:30:00Z", now)).toBe(false)
    expect(isSyncDue("2026-10-22T11:59:59Z", now)).toBe(false)
  })

  it("o resultado do Letterboxd em uma frase", () => {
    expect(letterboxdSummary(0, 0)).toBe("Tudo em dia: nenhum filme novo.")
    expect(letterboxdSummary(1, 0)).toBe("1 filme novo.")
    expect(letterboxdSummary(3, 2)).toBe("3 filmes novos e 2 atualizados.")
    expect(letterboxdSummary(0, 1)).toBe("1 atualizado.")
  })
})
