/**
 * Tradução de erro do Supabase para uma frase em português.
 *
 * Os casos aqui vieram de uso real da v1 — são os que as pessoas de fato
 * encontram. O resto cai no fallback, e nunca mostramos a exceção crua.
 */

export const FALLBACK_ERROR = "Algo deu errado."

/** O formato que interessa de um erro do supabase-js, sem importar o SDK. */
interface ErrorShape {
  message?: unknown
  code?: unknown
  details?: unknown
  hint?: unknown
  error_code?: unknown
  name?: unknown
  status?: unknown
}

function read(error: unknown): { text: string; code: string } {
  if (!error) return { text: "", code: "" }
  if (typeof error === "string") return { text: error.toLowerCase(), code: "" }

  const shape = error as ErrorShape
  const parts = [shape.message, shape.details, shape.hint, shape.name]
    .filter((part) => typeof part === "string")
    .join(" ")
  const code = String(shape.code ?? shape.error_code ?? "")

  return { text: `${parts} ${code}`.toLowerCase(), code }
}

/**
 * `translateError(erro)` devolve sempre uma frase pronta para a tela.
 */
export function translateError(error: unknown): string {
  const { text, code } = read(error)
  if (!text && !code) return FALLBACK_ERROR

  // ---- autenticação ------------------------------------------------------
  if (text.includes("otp_expired") || (text.includes("expired") && text.includes("link"))) {
    return "Esse link/código expirou. Peça um novo."
  }
  if (text.includes("otp_disabled")) {
    return "Login por e-mail está desativado no projeto do Supabase."
  }
  if (
    text.includes("signups_not_allowed") ||
    text.includes("signups not allowed") ||
    text.includes("signup is disabled") ||
    text.includes("user not found")
  ) {
    return "Este e-mail não tem convite. Peça ao administrador para adicioná-lo pelo painel do Supabase."
  }
  if (
    text.includes("invalid_token") ||
    text.includes("token has expired or is invalid") ||
    text.includes("invalid otp") ||
    text.includes("otp_invalid")
  ) {
    return "Código inválido ou expirado. Peça um novo."
  }
  if (
    text.includes("rate limit") ||
    text.includes("over_email_send_rate_limit") ||
    text.includes("too many requests") ||
    code === "429"
  ) {
    return "Muitos e-mails seguidos. Espere um minuto e tente de novo."
  }
  if (text.includes("jwt expired") || text.includes("pgrst301") || text.includes("session_expired")) {
    return "Sua sessão expirou. Faça login de novo."
  }

  // ---- banco -------------------------------------------------------------
  if (code === "23505" || text.includes("duplicate key")) {
    if (text.includes("categories_owner_id_name_key")) {
      return "Você já tem uma categoria com esse nome."
    }
    if (text.includes("profiles_username_key")) {
      return "Esse nome de usuário já está em uso."
    }
    if (text.includes("tags_name_key")) {
      return "Já existe uma tag com esse nome."
    }
    return "Isso já existe."
  }
  if (code === "42501" || text.includes("row-level security") || text.includes("row level security")) {
    return "Você só pode editar o que é seu."
  }
  if (isMissingSchema(error)) {
    return "O banco está desatualizado: rode no SQL Editor as migrações novas da pasta supabase/."
  }

  // ---- rede --------------------------------------------------------------
  if (
    text.includes("failed to fetch") ||
    text.includes("fetch failed") ||
    text.includes("networkerror") ||
    text.includes("enotfound") ||
    text.includes("econnrefused")
  ) {
    return "Não consegui falar com o Supabase. Confira as variáveis de ambiente e sua conexão."
  }

  return FALLBACK_ERROR
}

/**
 * Tabela ou função que ainda não existe no banco — o código novo chegou antes
 * da migração correspondente ter sido rodada no SQL Editor. Quem chama decide
 * se isso é fatal ou se dá para seguir sem (ex.: sem `entry_places`, o resto
 * do app continua funcionando).
 */
export function isMissingSchema(error: unknown): boolean {
  const { text, code } = read(error)
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code.toUpperCase())) return true
  if (text.includes("could not find the function") || text.includes("could not find the table")) {
    return true
  }
  return text.includes("does not exist") && (text.includes("relation") || text.includes("function"))
}

/**
 * Coluna que o banco ainda não tem — a migração que a cria não rodou
 * (`42703` do Postgres, `PGRST204` do PostgREST).
 */
export function isMissingColumn(error: unknown): boolean {
  const { text, code } = read(error)
  if (["42703", "PGRST204"].includes(code.toUpperCase())) return true
  return text.includes("column") && (text.includes("does not exist") || text.includes("could not find"))
}

/**
 * Códigos que chegam por querystring (`/login?erro=otp_expired`), vindos do
 * redirect do Supabase ou do nosso próprio `/auth/callback`.
 */
export function translateErrorCode(code: string | null | undefined): string | null {
  if (!code) return null
  return translateError(code)
}
