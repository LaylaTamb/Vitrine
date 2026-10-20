import { describe, expect, it } from "vitest"

import { translateError } from "./errors"
import {
  isReservedUsername,
  normalizeUsername,
  profilePath,
  usernameAllowance,
  usernameAllowanceText,
  usernameProblem,
} from "./username"

describe("formato do @", () => {
  it("guarda sem espaço, sem o @ da frente e em minúsculas", () => {
    expect(normalizeUsername("  @Layla_T ")).toBe("layla_t")
    expect(normalizeUsername("@@ana")).toBe("ana")
  })

  it("aceita letras, números e _, de 3 a 30", () => {
    expect(usernameProblem("ana")).toBeNull()
    expect(usernameProblem("@Layla_2026")).toBeNull()
    expect(usernameProblem("a".repeat(30))).toBeNull()
  })

  it("recusa curto, longo, acento, espaço e hífen", () => {
    expect(usernameProblem("ab")).toMatch(/pelo menos 3/)
    expect(usernameProblem("a".repeat(31))).toMatch(/até 30/)
    expect(usernameProblem("joão")).toMatch(/sem acento/)
    expect(usernameProblem("ana maria")).toMatch(/sem acento/)
    expect(usernameProblem("ana-maria")).toMatch(/sem acento/)
  })

  it("recusa as palavras reservadas", () => {
    expect(isReservedUsername("Admin")).toBe(true)
    expect(isReservedUsername("@vitrine")).toBe(true)
    expect(usernameProblem("configuracoes")).toMatch(/reservado/)
    expect(isReservedUsername("layla")).toBe(false)
  })

  it("monta o endereço do perfil", () => {
    expect(profilePath("layla")).toBe("/v/layla")
  })
})

describe("limite de trocas", () => {
  const now = new Date("2026-10-20T15:00:00Z")

  it("sem troca recente, cabem 2", () => {
    expect(usernameAllowance([], now)).toEqual({ remaining: 2, nextReleaseAt: null })
    // a de 20 dias atrás já saiu da janela
    expect(usernameAllowance(["2026-09-30T15:00:00Z"], now).remaining).toBe(2)
  })

  it("uma troca recente: cabe mais 1, até ela completar 14 dias", () => {
    const allowance = usernameAllowance(["2026-10-15T15:00:00Z"], now)
    expect(allowance.remaining).toBe(1)
    expect(allowance.nextReleaseAt?.toISOString()).toBe("2026-10-29T15:00:00.000Z")
    expect(usernameAllowanceText(allowance)).toBe(
      "Você pode trocar mais 1 vez até 29/10. O @ antigo continua levando ao seu perfil por 14 dias."
    )
  })

  it("duas trocas recentes: nenhuma, e diz quando volta (no horário de Brasília)", () => {
    const allowance = usernameAllowance(["2026-10-19T15:00:00Z", "2026-10-10T13:30:00Z"], now)
    expect(allowance.remaining).toBe(0)
    expect(allowance.nextReleaseAt?.toISOString()).toBe("2026-10-24T13:30:00.000Z")
    expect(usernameAllowanceText(allowance)).toBe(
      "Você já trocou o @ 2 vezes nos últimos 14 dias. Poderá trocar de novo em 24/10, às 10:30."
    )
  })

  it("explica a regra quando ainda não trocou", () => {
    expect(usernameAllowanceText({ remaining: 2, nextReleaseAt: null })).toMatch(
      /até 2 vezes a cada 14 dias/
    )
  })
})

describe("erros da troca de @ no banco", () => {
  it("vira frase em português", () => {
    expect(translateError({ code: "P0001", message: "username_rate_limited" })).toMatch(
      /2 vezes nos últimos 14 dias/
    )
    expect(translateError({ code: "P0001", message: "username_taken" })).toBe(
      "Esse nome de usuário já está em uso."
    )
    expect(translateError({ code: "P0001", message: "username_reserved" })).toMatch(/reservado/)
    expect(translateError({ code: "P0001", message: "username_invalid" })).toMatch(/3 a 30/)
    // duas pessoas pegando o mesmo @ no mesmo instante: a chave única segura
    expect(
      translateError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_username_key"',
      })
    ).toBe("Esse nome de usuário já está em uso.")
  })
})
