import { describe, expect, it } from "vitest"

import { newPasswordSchema, signInSchema, signUpSchema } from "@/lib/actions/schemas"

import {
  authMethodsOf,
  needsNewPassword,
  passwordChecks,
  passwordProblem,
  safeNextPath,
} from "./auth"

describe("requisitos da senha", () => {
  it("pede 8 caracteres, uma letra e um número", () => {
    expect(passwordProblem("abc12345")).toBeNull()
    expect(passwordProblem("Senha2026")).toBeNull()
    expect(passwordProblem("abc123")).toBe("A senha precisa de pelo menos 8 caracteres.")
    expect(passwordProblem("12345678")).toBe("A senha precisa de pelo menos uma letra (de a a z).")
    expect(passwordProblem("abcdefgh")).toBe("A senha precisa de pelo menos um número.")
  })

  it("conta letra como o Supabase conta: sem acento", () => {
    expect(passwordProblem("áéíóú123")).toBe("A senha precisa de pelo menos uma letra (de a a z).")
    expect(passwordProblem("ação1234")).toBeNull()
  })

  it("confere a confirmação", () => {
    expect(passwordProblem("abc12345", "abc12346")).toBe("As duas senhas não são iguais.")
    expect(passwordProblem("abc12345", "abc12345")).toBeNull()
  })

  it("recusa o que o bcrypt cortaria (72 bytes)", () => {
    expect(passwordProblem(`a1${"x".repeat(70)}`)).toBeNull()
    expect(passwordProblem(`a1${"x".repeat(71)}`)).toContain("longa demais")
    // acento ocupa 2 bytes
    expect(passwordProblem(`a1${"é".repeat(36)}`)).toContain("longa demais")
  })

  it("marca a lista da tela", () => {
    expect(passwordChecks("abc", "").map((check) => [check.id, check.ok])).toEqual([
      ["length", false],
      ["letter", true],
      ["digit", false],
      ["match", false],
    ])
    expect(passwordChecks("abc12345").map((check) => check.id)).toEqual(["length", "letter", "digit"])
  })
})

describe("validação no servidor", () => {
  it("normaliza o e-mail e não aplica a regra de senha nova no login", () => {
    expect(signInSchema.parse({ email: "  Voce@Exemplo.COM ", password: "x" })).toEqual({
      email: "voce@exemplo.com",
      password: "x",
    })
    expect(signInSchema.safeParse({ email: "nao-e-email", password: "x" }).success).toBe(false)
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false)
  })

  it("no cadastro e na troca, exige a senha forte e as duas iguais", () => {
    // (a caixa dos 18 anos + Termos tem os testes dela em terms.test.ts)
    const conta = { email: "a@b.co", acceptTerms: true }
    expect(
      signUpSchema.safeParse({ ...conta, password: "abc12345", confirm: "abc12345" }).success
    ).toBe(true)
    const fraca = signUpSchema.safeParse({ ...conta, password: "abc", confirm: "abc" })
    expect(fraca.success).toBe(false)
    expect(fraca.error?.issues[0]?.message).toBe("A senha precisa de pelo menos 8 caracteres.")
    const diferente = newPasswordSchema.safeParse({ password: "abc12345", confirm: "abc12399" })
    expect(diferente.error?.issues[0]?.message).toBe("As duas senhas não são iguais.")
  })
})

describe("destino depois de entrar", () => {
  it("só aceita caminho interno", () => {
    expect(safeNextPath("/categoria/123?aba=numeros")).toBe("/categoria/123?aba=numeros")
    expect(safeNextPath(null)).toBe("/")
    expect(safeNextPath("https://malicioso.com")).toBe("/")
    expect(safeNextPath("//malicioso.com")).toBe("/")
    expect(safeNextPath("/\\malicioso.com")).toBe("/")
    expect(safeNextPath("/\tx")).toBe("/")
  })

  it("quem chega por recuperação ou convite vai criar a senha", () => {
    expect(authMethodsOf([{ method: "recovery", timestamp: 1 }])).toEqual(["recovery"])
    expect(authMethodsOf(["password", "otp"])).toEqual(["password", "otp"])
    expect(authMethodsOf(undefined)).toEqual([])
    expect(needsNewPassword(["recovery"])).toBe(true)
    expect(needsNewPassword(["invite"])).toBe(true)
    expect(needsNewPassword(["password"])).toBe(false)
  })
})
