/**
 * O @ de cada pessoa: o formato, as palavras reservadas e o limite de trocas.
 *
 * Quem garante de verdade é o banco (`change_username`, migração 15); aqui
 * ficam as mesmas regras para a tela avisar antes de mandar.
 */

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

/** No máximo 2 trocas a cada 14 dias; o @ antigo redireciona (e fica reservado) por 14 dias. */
export const USERNAME_CHANGES_PER_WINDOW = 2
export const USERNAME_WINDOW_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/** A mesma lista de `is_reserved_username` (supabase/15) — mudou uma, mude a outra. */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrador",
  "adm",
  "root",
  "suporte",
  "ajuda",
  "sistema",
  "oficial",
  "vitrine",
  "equipe",
  "contato",
  "seguranca",
  "v",
  "u",
  "api",
  "app",
  "www",
  "auth",
  "demo",
  "login",
  "entrar",
  "sair",
  "cadastro",
  "conta",
  "mapa",
  "filtro",
  "tags",
  "explorar",
  "favoritos",
  "configuracoes",
  "usuarios",
  "pessoas",
  "categoria",
  "compartilhar",
  "termos",
  "privacidade",
  "matches",
  "notificacoes",
  "importar",
  "null",
  "undefined",
]

/** Como o @ é guardado: sem espaços, sem o "@" da frente, em minúsculas. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase()
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(normalizeUsername(username))
}

/** A frase do que está errado no @ — `null` quando ele serve. */
export function usernameProblem(raw: string): string | null {
  const username = normalizeUsername(raw)
  if (username.length < USERNAME_MIN_LENGTH) {
    return `O nome de usuário precisa de pelo menos ${USERNAME_MIN_LENGTH} caracteres.`
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Nome de usuário muito longo: até ${USERNAME_MAX_LENGTH} caracteres.`
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Use só letras sem acento, números e _."
  }
  if (isReservedUsername(username)) {
    return "Esse nome de usuário é reservado. Escolha outro."
  }
  return null
}

/** O endereço do perfil de alguém. */
export function profilePath(username: string): string {
  return `/v/${username}`
}

export interface UsernameAllowance {
  /** Quantas trocas ainda cabem agora. */
  remaining: number
  /**
   * Quando a troca mais antiga da janela sai dela (e libera uma vaga).
   * `null` = nenhuma troca nos últimos 14 dias.
   */
  nextReleaseAt: Date | null
}

/** Quantas trocas ainda cabem, a partir das datas das trocas já feitas. */
export function usernameAllowance(changedAt: string[], now: Date): UsernameAllowance {
  const windowStart = now.getTime() - USERNAME_WINDOW_DAYS * DAY_MS
  const recent = changedAt
    .map((iso) => new Date(iso).getTime())
    .filter((time) => Number.isFinite(time) && time > windowStart)
    .sort((a, b) => a - b)
  return {
    remaining: Math.max(0, USERNAME_CHANGES_PER_WINDOW - recent.length),
    nextReleaseAt:
      recent.length > 0 ? new Date(recent[0] + USERNAME_WINDOW_DAYS * DAY_MS) : null,
  }
}

const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
})

const HOUR_MINUTE = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

/** A regra em palavras, embaixo do campo do @. */
export function usernameAllowanceText(allowance: UsernameAllowance): string {
  const { remaining, nextReleaseAt } = allowance
  if (remaining === 0 && nextReleaseAt) {
    return `Você já trocou o @ ${USERNAME_CHANGES_PER_WINDOW} vezes nos últimos ${USERNAME_WINDOW_DAYS} dias. Poderá trocar de novo em ${DAY_MONTH.format(nextReleaseAt)}, às ${HOUR_MINUTE.format(nextReleaseAt)}.`
  }
  if (remaining < USERNAME_CHANGES_PER_WINDOW && nextReleaseAt) {
    return `Você pode trocar mais ${remaining} ${remaining === 1 ? "vez" : "vezes"} até ${DAY_MONTH.format(nextReleaseAt)}. O @ antigo continua levando ao seu perfil por ${USERNAME_WINDOW_DAYS} dias.`
  }
  return `Você pode trocar o @ até ${USERNAME_CHANGES_PER_WINDOW} vezes a cada ${USERNAME_WINDOW_DAYS} dias. O @ antigo continua levando ao seu perfil por ${USERNAME_WINDOW_DAYS} dias.`
}
