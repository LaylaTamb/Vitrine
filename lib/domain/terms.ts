/**
 * Termos de uso e Política de privacidade: a versão em vigor, quem é a
 * controladora dos dados e as regras do aceite.
 *
 * O aceite fica no `user_metadata` da conta (Supabase Auth) — o middleware lê
 * de graça a cada requisição — e é copiado para o perfil pelo banco
 * (migração 16), que é o registro que fica.
 */

import { normalizeUsername } from "./username"

/** Mudou o texto de um dos dois? Nova versão: todo mundo aceita de novo. */
export const TERMS_VERSION = "2026-10-19"
export const TERMS_EFFECTIVE_DATE = "19 de outubro de 2026"

export const MINIMUM_AGE = 18

/** Quem responde pelos dados (LGPD): pessoa física, por enquanto. */
export const DATA_CONTROLLER = {
  name: "Layla Sabatini Tambellini",
  email: "laylatambellini@gmail.com",
} as const

/** O que vai para o `user_metadata` no cadastro e na tela de aceite. */
export function termsAcceptance(now: Date): {
  terms_version: string
  terms_accepted_at: string
  adult_confirmed: true
} {
  return {
    terms_version: TERMS_VERSION,
    terms_accepted_at: now.toISOString(),
    adult_confirmed: true,
  }
}

/** A conta já aceitou a versão em vigor (e confirmou os 18 anos)? */
export function hasAcceptedCurrentTerms(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const data = metadata as Record<string, unknown>
  return data.terms_version === TERMS_VERSION && data.adult_confirmed === true
}

/**
 * Onde quem ainda não aceitou pode estar: a própria tela de aceite, os dois
 * textos, as telas de conta, os links dos e-mails e a demonstração.
 */
const TERMS_FREE_PREFIXES = [
  "/aceitar-termos",
  "/termos",
  "/privacidade",
  "/auth",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/demo",
]

/** Quem está logado e ainda não aceitou a versão em vigor vai para /aceitar-termos? */
export function needsTermsAcceptance(pathname: string, metadata: unknown): boolean {
  if (hasAcceptedCurrentTerms(metadata)) return false
  return !TERMS_FREE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/** "Excluir minha conta": a pessoa digitou o próprio @ (com ou sem o @)? */
export function deleteConfirmationMatches(typed: string, username: string): boolean {
  const clean = normalizeUsername(typed)
  return clean.length > 0 && clean === normalizeUsername(username)
}
