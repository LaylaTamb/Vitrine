/**
 * Steam (migração 24): o login da Steam (OpenID 2.0) prova qual conta é da
 * pessoa, e a Web API (`GetOwnedGames`) traz os jogos com as horas jogadas.
 * Aqui fica só o que é puro — montar e conferir as mensagens do OpenID, ler a
 * resposta da API e as frases; a rede fica em `lib/steam/`.
 */

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login"

const OPENID_NS = "http://specs.openid.net/auth/2.0"
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select"
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

/** O SteamID64: 17 dígitos. */
export const STEAM_ID_PATTERN = /^\d{17}$/

/** O erro de usar a Steam antes de a migração 24 rodar. */
export const STEAM_NOT_READY =
  "A conexão com a Steam ainda não está no banco: rode supabase/24_connected_accounts.sql no SQL Editor do Supabase (e grave o segredo do servidor, como o topo dele explica)."

/** Para onde mandar a pessoa entrar na Steam. */
export function openIdLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  })
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`
}

export type OpenIdCheck =
  | { ok: true; steamId: string; verification: URLSearchParams }
  | { ok: false; reason: "cancelled" | "invalid" }

/**
 * Confere a volta da Steam ANTES de perguntar a ela se é legítima: modo,
 * endpoint, endereço de volta (tem que ser o nosso) e o SteamID no formato
 * certo. Devolve o corpo do `check_authentication` — a Steam é quem diz se a
 * assinatura vale (`isOpenIdValid`).
 */
export function checkOpenIdReturn(params: URLSearchParams, expectedReturnTo: string): OpenIdCheck {
  const mode = params.get("openid.mode")
  if (mode === "cancel") return { ok: false, reason: "cancelled" }
  if (mode !== "id_res") return { ok: false, reason: "invalid" }
  if (params.get("openid.ns") !== OPENID_NS) return { ok: false, reason: "invalid" }
  if (params.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) {
    return { ok: false, reason: "invalid" }
  }

  // A Steam devolve o return_to com o que mandamos; o resto da URL tem que bater.
  const returnTo = params.get("openid.return_to") ?? ""
  if (returnTo.split("?")[0] !== expectedReturnTo.split("?")[0]) {
    return { ok: false, reason: "invalid" }
  }

  const claimed = CLAIMED_ID.exec(params.get("openid.claimed_id") ?? "")
  const identity = CLAIMED_ID.exec(params.get("openid.identity") ?? "")
  if (!claimed || !identity || claimed[1] !== identity[1]) return { ok: false, reason: "invalid" }

  // Os campos assinados têm que estar todos presentes.
  const signed = (params.get("openid.signed") ?? "").split(",").filter(Boolean)
  if (!params.get("openid.sig") || signed.length === 0) return { ok: false, reason: "invalid" }
  const required = ["claimed_id", "identity", "return_to", "response_nonce"]
  if (!required.every((key) => signed.includes(key))) return { ok: false, reason: "invalid" }

  const verification = new URLSearchParams()
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) verification.set(key, value)
  }
  verification.set("openid.mode", "check_authentication")
  return { ok: true, steamId: claimed[1], verification }
}

/** A resposta do `check_authentication`: "ns:…\nis_valid:true\n". */
export function isOpenIdValid(body: string): boolean {
  return /^is_valid\s*:\s*true\s*$/m.test(body)
}

// ---------------------------------------------------------------------------
// Web API
// ---------------------------------------------------------------------------

export interface SteamGame {
  appid: number
  name: string
  /** `playtime_forever`: já vem em minutos — o campo Horas jogadas guarda minutos. */
  minutes: number
}

export type OwnedGames = { status: "ok"; games: SteamGame[] } | { status: "private" }

/**
 * A resposta do `GetOwnedGames` (com `include_appinfo`). Perfil com os
 * detalhes dos jogos privados devolve `{"response": {}}` — sem `game_count`.
 */
export function parseOwnedGames(json: unknown): OwnedGames {
  const response = (json as { response?: unknown } | null)?.response
  if (!response || typeof response !== "object") return { status: "private" }
  const body = response as { game_count?: unknown; games?: unknown }
  if (typeof body.game_count !== "number") return { status: "private" }
  const games = (Array.isArray(body.games) ? body.games : []).flatMap((raw): SteamGame[] => {
    const game = raw as { appid?: unknown; name?: unknown; playtime_forever?: unknown }
    if (typeof game.appid !== "number" || !Number.isInteger(game.appid) || game.appid <= 0) {
      return []
    }
    const name = typeof game.name === "string" ? game.name.trim() : ""
    if (!name) return []
    const minutes =
      typeof game.playtime_forever === "number" && game.playtime_forever > 0
        ? Math.trunc(game.playtime_forever)
        : 0
    return [{ appid: game.appid, name: name.slice(0, 200), minutes }]
  })
  return { status: "ok", games }
}

/** O nome de exibição no `GetPlayerSummaries`. */
export function parsePersonaName(json: unknown): string | null {
  const players = (json as { response?: { players?: unknown } } | null)?.response?.players
  const first = Array.isArray(players) ? (players[0] as { personaname?: unknown }) : undefined
  const name = typeof first?.personaname === "string" ? first.personaname.trim() : ""
  return name ? name.slice(0, 100) : null
}

// ---------------------------------------------------------------------------
// Frases
// ---------------------------------------------------------------------------

export const STEAM_PRIVATE =
  "Seu perfil da Steam está privado. Na Steam, em Editar perfil → Privacidade, deixe “Detalhes dos jogos” como Público e sincronize de novo."

/** O resultado de sincronizar, em uma frase. */
export function syncSummary(created: number, updated: number): string {
  if (created === 0 && updated === 0) return "Tudo em dia: nenhum jogo novo nem hora a mais."
  const parts = []
  if (created > 0) parts.push(created === 1 ? "1 jogo novo" : `${created} jogos novos`)
  if (updated > 0) {
    parts.push(updated === 1 ? "1 com horas atualizadas" : `${updated} com horas atualizadas`)
  }
  return `Steam sincronizada: ${parts.join(" e ")}.`
}

/** O recado da volta da Steam (`/configuracoes?steam=…`). */
export const STEAM_RETURN_MESSAGES: Record<string, { text: string; good: boolean }> = {
  ok: { text: "Steam conectada. Seus jogos estão na categoria da pasta “Steam”.", good: true },
  privado: { text: STEAM_PRIVATE, good: false },
  ocupada: {
    text: "Esta conta da Steam já está ligada a outro perfil do Vitrine.",
    good: false,
  },
  cancelado: { text: "Você cancelou a entrada na Steam. Nada mudou.", good: false },
  invalido: {
    text: "A Steam não confirmou a entrada. Tente conectar de novo.",
    good: false,
  },
  "sem-chave": {
    text: "A conexão com a Steam ainda não foi ativada neste Vitrine (faltam a STEAM_API_KEY e o CRON_SECRET no servidor).",
    good: false,
  },
  "sem-banco": { text: STEAM_NOT_READY, good: false },
  segredo: {
    text: "O segredo do servidor (CRON_SECRET) não bate com o gravado no banco: grave de novo, como o topo do supabase/24_connected_accounts.sql explica.",
    good: false,
  },
  erro: { text: "A Steam não respondeu agora. Tente de novo em alguns minutos.", good: false },
}
