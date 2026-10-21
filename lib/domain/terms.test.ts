import { describe, expect, it } from "vitest"

import { acceptTermsSchema, signUpSchema } from "@/lib/actions/schemas"

import {
  deleteConfirmationMatches,
  hasAcceptedCurrentTerms,
  needsTermsAcceptance,
  termsAcceptance,
  TERMS_VERSION,
} from "./terms"

describe("aceite dos termos", () => {
  it("grava a versão em vigor, a data e os 18 anos", () => {
    expect(termsAcceptance(new Date("2026-10-19T12:00:00Z"))).toEqual({
      terms_version: TERMS_VERSION,
      terms_accepted_at: "2026-10-19T12:00:00.000Z",
      adult_confirmed: true,
    })
  })

  it("só vale a versão em vigor, com os 18 anos confirmados", () => {
    expect(hasAcceptedCurrentTerms(termsAcceptance(new Date()))).toBe(true)
    expect(hasAcceptedCurrentTerms({ terms_version: "2020-01-01", adult_confirmed: true })).toBe(
      false
    )
    expect(hasAcceptedCurrentTerms({ terms_version: TERMS_VERSION })).toBe(false)
    expect(hasAcceptedCurrentTerms({ terms_version: TERMS_VERSION, adult_confirmed: "true" })).toBe(
      false
    )
    expect(hasAcceptedCurrentTerms({})).toBe(false)
    expect(hasAcceptedCurrentTerms(null)).toBe(false)
  })

  it("conta sem aceite vai para a tela de aceite, menos nas telas livres", () => {
    expect(needsTermsAcceptance("/", {})).toBe(true)
    expect(needsTermsAcceptance("/categoria/abc", undefined)).toBe(true)
    expect(needsTermsAcceptance("/configuracoes", {})).toBe(true)
    expect(needsTermsAcceptance("/aceitar-termos", {})).toBe(false)
    expect(needsTermsAcceptance("/termos", {})).toBe(false)
    expect(needsTermsAcceptance("/privacidade", {})).toBe(false)
    expect(needsTermsAcceptance("/redefinir-senha", {})).toBe(false)
    expect(needsTermsAcceptance("/auth/callback", {})).toBe(false)
    // prefixo inteiro, não pedaço de nome
    expect(needsTermsAcceptance("/termos-falsos", {})).toBe(true)
  })

  it("quem já aceitou passa direto", () => {
    expect(needsTermsAcceptance("/", termsAcceptance(new Date()))).toBe(false)
  })
})

describe("excluir conta", () => {
  it("confere o @ digitado, com ou sem o @ e sem diferenciar maiúsculas", () => {
    expect(deleteConfirmationMatches("@layla", "layla")).toBe(true)
    expect(deleteConfirmationMatches(" Layla ", "layla")).toBe(true)
    expect(deleteConfirmationMatches("lay", "layla")).toBe(false)
    expect(deleteConfirmationMatches("", "layla")).toBe(false)
    expect(deleteConfirmationMatches("@", "layla")).toBe(false)
  })
})

describe("o servidor também confere a caixa", () => {
  const account = { email: "teste@exemplo.com", password: "teste1234", confirm: "teste1234" }

  it("cadastro sem a caixa marcada não passa", () => {
    expect(signUpSchema.safeParse(account).success).toBe(false)
    expect(signUpSchema.safeParse({ ...account, acceptTerms: false }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...account, acceptTerms: "true" }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...account, acceptTerms: true }).success).toBe(true)
  })

  it("tela de aceite também", () => {
    expect(acceptTermsSchema.safeParse({ acceptTerms: false }).success).toBe(false)
    expect(acceptTermsSchema.safeParse({ acceptTerms: true, next: "/mapa" }).success).toBe(true)
  })
})
