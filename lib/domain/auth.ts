/**
 * Regras do login por e-mail e senha que a tela e o servidor dividem: os
 * requisitos da senha e o destino depois de entrar.
 *
 * Quem guarda e confere a senha é o Supabase Auth (hash no servidor dele) —
 * aqui não passa senha nenhuma para o banco do app.
 */

export const PASSWORD_MIN_LENGTH = 8
/** O limite do bcrypt do Supabase, em bytes: o que passar disso seria ignorado em silêncio. */
export const PASSWORD_MAX_BYTES = 72

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export interface PasswordCheck {
  id: "length" | "letter" | "digit" | "match"
  label: string
  ok: boolean
}

/**
 * A lista que aparece embaixo do campo, marcando o que já foi cumprido.
 * `confirm` ausente = sem a linha "as duas senhas são iguais".
 */
export function passwordChecks(password: string, confirm?: string): PasswordCheck[] {
  const checks: PasswordCheck[] = [
    {
      id: "length",
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    // Sem acento: é o que o "letters and digits" do Supabase reconhece como letra.
    { id: "letter", label: "Uma letra (a–z)", ok: /[A-Za-z]/.test(password) },
    { id: "digit", label: "Um número", ok: /\d/.test(password) },
  ]
  if (confirm !== undefined) {
    checks.push({
      id: "match",
      label: "As duas senhas iguais",
      ok: confirm.length > 0 && confirm === password,
    })
  }
  return checks
}

/** A frase do primeiro requisito que falta — `null` quando a senha serve. */
export function passwordProblem(password: string, confirm?: string): string | null {
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return "Senha longa demais: use até 72 caracteres (menos, se tiver acento)."
  }
  const failed = passwordChecks(password, confirm).find((check) => !check.ok)
  if (!failed) return null
  switch (failed.id) {
    case "length":
      return `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
    case "letter":
      return "A senha precisa de pelo menos uma letra (de a a z)."
    case "digit":
      return "A senha precisa de pelo menos um número."
    case "match":
      return "As duas senhas não são iguais."
  }
}

/**
 * Para onde ir depois de entrar: só caminho DENTRO do app. Recusa
 * `//outro-site.com` e `/\outro-site.com`, que o navegador trataria como
 * endereço externo — senão um link malicioso de login levaria para fora.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/")) return fallback
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(raw)) return fallback
  return raw
}

/** As formas de entrar que o `amr` do token registra ("recovery", "invite", "password"…). */
export function authMethodsOf(amr: unknown): string[] {
  if (!Array.isArray(amr)) return []
  return amr
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && "method" in entry
          ? String((entry as { method: unknown }).method)
          : ""
    )
    .filter(Boolean)
}

/**
 * Entrou por um link de recuperação ou de convite? Então a próxima tela é a de
 * criar a senha — quem chega por aí pode nem ter uma ainda.
 */
export function needsNewPassword(methods: string[]): boolean {
  return methods.includes("recovery") || methods.includes("invite")
}
