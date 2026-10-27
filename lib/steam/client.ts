import {
  isOpenIdValid,
  parseAppDetails,
  parseOwnedGames,
  parsePersonaName,
  parsePlayerAchievements,
  STEAM_OPENID_ENDPOINT,
  type OwnedGames,
  type SteamStoreDetails,
} from "@/lib/domain/steam"

/**
 * A rede da Steam, só no servidor. `STEAM_API_KEY` (gratuita, em
 * steamcommunity.com/dev/apikey) nunca vai para o navegador; `CRON_SECRET` é
 * o segredo do servidor — protege a rota diária e abre as funções do banco
 * que gravam a conta e os jogos (migração 24).
 */

const TIMEOUT_MS = 15_000
/** Os detalhes de cada jogo são muitos pedidos pequenos: espera menos por cada um. */
const DETAIL_TIMEOUT_MS = 6_000

export function steamApiKey(): string | null {
  return process.env.STEAM_API_KEY?.trim() || null
}

/** O segredo do servidor — no mínimo 32 caracteres, senão é como se faltasse. */
export function serverSecret(): string | null {
  const value = process.env.CRON_SECRET?.trim()
  return value && value.length >= 32 ? value : null
}

/** A Steam está ativada neste Vitrine? (As duas variáveis no servidor.) */
export function steamConfigured(): boolean {
  return Boolean(steamApiKey() && serverSecret())
}

/** Pergunta à Steam se a volta do login é legítima (`check_authentication`). */
export async function verifyOpenId(verification: URLSearchParams): Promise<boolean> {
  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verification.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  return response.ok && isOpenIdValid(await response.text())
}

async function webApi(
  path: string,
  params: Record<string, string>,
  timeout = TIMEOUT_MS
): Promise<unknown> {
  const key = steamApiKey()
  if (!key) throw new Error("Falta a STEAM_API_KEY no servidor.")
  const url = new URL(`https://api.steampowered.com/${path}`)
  for (const [name, value] of Object.entries({ ...params, key, format: "json" })) {
    url.searchParams.set(name, value)
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: "no-store" })
  if (!response.ok) throw new Error(`A Steam respondeu ${response.status}.`)
  return response.json()
}

/** Os jogos da conta, com as horas (`include_appinfo` traz o nome). */
export async function fetchOwnedGames(steamId: string): Promise<OwnedGames> {
  return parseOwnedGames(
    await webApi("IPlayerService/GetOwnedGames/v1/", {
      steamid: steamId,
      include_appinfo: "1",
      include_played_free_games: "1",
    })
  )
}

/** O nome de exibição da conta (ou `null` se a Steam não disser). */
export async function fetchPersonaName(steamId: string): Promise<string | null> {
  try {
    return parsePersonaName(
      await webApi("ISteamUser/GetPlayerSummaries/v2/", { steamids: steamId })
    )
  } catch {
    return null
  }
}

/**
 * Gênero, desenvolvedora e ano de um jogo, pela loja (sem chave; em
 * português). `null` = a loja não respondeu agora (tenta de novo depois); jogo
 * fora da loja volta com tudo vazio.
 */
export async function fetchAppDetails(appid: string): Promise<SteamStoreDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails")
  url.searchParams.set("appids", appid)
  url.searchParams.set("l", "brazilian")
  url.searchParams.set("cc", "br")
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DETAIL_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!response.ok) return null
    return parseAppDetails(await response.json(), appid)
  } catch {
    return null
  }
}

/** Quantas conquistas a pessoa desbloqueou num jogo (`null` = sem conquistas ou sem resposta). */
export async function fetchPlayerAchievements(
  steamId: string,
  appid: string
): Promise<{ unlocked: number; total: number } | null> {
  try {
    return parsePlayerAchievements(
      await webApi(
        "ISteamUserStats/GetPlayerAchievements/v1/",
        { steamid: steamId, appid },
        DETAIL_TIMEOUT_MS
      )
    )
  } catch {
    // Jogo sem conquistas a Steam responde com erro (400): é o mesmo que "não tem".
    return null
  }
}
