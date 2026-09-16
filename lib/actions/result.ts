import { translateError } from "@/lib/domain/errors"

/**
 * O que toda Server Action devolve. Nunca a exceção crua: a UI recebe sempre
 * uma frase em português pronta para o toast.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: translateError(error) }
}

/** Erro de validação do zod vira a primeira mensagem, que é a mais útil. */
export function failValidation(issues: { message: string }[]): ActionResult<never> {
  return { ok: false, error: issues[0]?.message ?? "Confira os campos e tente de novo." }
}
