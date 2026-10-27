import { describe, expect, it } from "vitest"

import {
  checkOpenIdReturn,
  isOpenIdValid,
  openIdLoginUrl,
  parseAppDetails,
  parseDetailsTodo,
  parseOwnedGames,
  parsePersonaName,
  parsePlayerAchievements,
  steamDetail,
  syncSummary,
} from "./steam"

const RETURN_TO = "https://vitrine.app/api/steam/retorno"
const STEAM_ID = "76561197960435530"

function steamReturn(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.return_to": `${RETURN_TO}?estado=abc`,
    "openid.response_nonce": "2026-10-20T12:00:00Zabc",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJh",
    ...overrides,
  })
}

describe("login da Steam (OpenID)", () => {
  it("manda para a Steam escolher a conta", () => {
    const url = new URL(openIdLoginUrl(`${RETURN_TO}?estado=abc`, "https://vitrine.app"))
    expect(url.origin + url.pathname).toBe("https://steamcommunity.com/openid/login")
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup")
    expect(url.searchParams.get("openid.return_to")).toBe(`${RETURN_TO}?estado=abc`)
    expect(url.searchParams.get("openid.realm")).toBe("https://vitrine.app")
  })

  it("aceita a volta certa e monta o check_authentication", () => {
    const result = checkOpenIdReturn(steamReturn({ extra: "x" }), RETURN_TO)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.steamId).toBe(STEAM_ID)
    expect(result.verification.get("openid.mode")).toBe("check_authentication")
    expect(result.verification.get("openid.sig")).toBe("c2lnbmF0dXJh")
    expect(result.verification.has("extra")).toBe(false)
  })

  it("recusa volta adulterada", () => {
    const cases: Record<string, string>[] = [
      { "openid.mode": "cancel" },
      { "openid.mode": "setup_needed" },
      { "openid.op_endpoint": "https://golpe.com/openid/login" },
      { "openid.return_to": "https://golpe.com/api/steam/retorno" },
      { "openid.claimed_id": "https://steamcommunity.com/openid/id/123" },
      { "openid.identity": "https://steamcommunity.com/openid/id/76561197960435531" },
      { "openid.signed": "op_endpoint,claimed_id" },
      { "openid.sig": "" },
    ]
    expect(checkOpenIdReturn(steamReturn(cases[0]), RETURN_TO)).toEqual({
      ok: false,
      reason: "cancelled",
    })
    for (const overrides of cases.slice(1)) {
      expect(checkOpenIdReturn(steamReturn(overrides), RETURN_TO).ok).toBe(false)
    }
  })

  it("lê a resposta da Steam", () => {
    expect(isOpenIdValid("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n")).toBe(true)
    expect(isOpenIdValid("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n")).toBe(false)
    expect(isOpenIdValid("is_valid:truex")).toBe(false)
  })
})

describe("Web API", () => {
  it("lê os jogos (playtime_forever já em minutos)", () => {
    expect(
      parseOwnedGames({
        response: {
          game_count: 4,
          games: [
            { appid: 620, name: " Portal 2 ", playtime_forever: 754, playtime_2weeks: 30 },
            { appid: 10, name: "Counter-Strike", playtime_forever: 0 },
            { appid: 0, name: "inválido" },
            { appid: 70, name: "" },
          ],
        },
      })
    ).toEqual({
      status: "ok",
      games: [
        { appid: 620, name: "Portal 2", minutes: 754, recent: true },
        { appid: 10, name: "Counter-Strike", minutes: 0, recent: false },
      ],
    })
    expect(parseOwnedGames({ response: { game_count: 0 } })).toEqual({ status: "ok", games: [] })
  })

  it("detalhes da loja: gênero, desenvolvedora e o ano de qualquer data", () => {
    expect(
      parseAppDetails(
        {
          "620": {
            success: true,
            data: {
              genres: [{ description: "Ação" }, { description: "Aventura" }, { id: 3 }],
              developers: ["Valve"],
              release_date: { date: "18 de abr. de 2011" },
            },
          },
        },
        "620"
      )
    ).toEqual({ genres: ["Ação", "Aventura"], developers: ["Valve"], year: 2011 })
    // fora da loja: tudo vazio (e mesmo assim conta como "já olhei")
    expect(parseAppDetails({ "70": { success: false } }, "70")).toEqual({
      genres: [],
      developers: [],
      year: null,
    })
  })

  it("conquistas da pessoa: desbloqueadas de quantas existem", () => {
    expect(
      parsePlayerAchievements({
        playerstats: {
          success: true,
          achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
        },
      })
    ).toEqual({ unlocked: 2, total: 3 })
    expect(
      parsePlayerAchievements({ playerstats: { success: false, error: "no stats" } })
    ).toBeNull()
    expect(parsePlayerAchievements({ playerstats: { success: true, achievements: [] } })).toBeNull()
  })

  it("o que vai para o banco só leva o que se sabe", () => {
    expect(
      steamDetail(
        "620",
        { genres: ["Ação"], developers: ["Valve"], year: 2011 },
        { unlocked: 23, total: 51 }
      )
    ).toEqual({
      appid: "620",
      genero: "Ação",
      desenvolvedora: "Valve",
      ano: 2011,
      conquistas: "23 de 51",
    })
    expect(steamDetail("70", null, null)).toEqual({ appid: "70" })
    expect(parseDetailsTodo(["620", 70, "x", "10"])).toEqual(["620", "10"])
  })

  it("perfil privado vem sem game_count", () => {
    expect(parseOwnedGames({ response: {} })).toEqual({ status: "private" })
    expect(parseOwnedGames(null)).toEqual({ status: "private" })
  })

  it("nome de exibição", () => {
    expect(parsePersonaName({ response: { players: [{ personaname: " Layla " }] } })).toBe("Layla")
    expect(parsePersonaName({ response: { players: [] } })).toBeNull()
  })

  it("resume a sincronização", () => {
    expect(syncSummary(0, 0)).toBe("Tudo em dia: nenhum jogo novo nem hora a mais.")
    expect(syncSummary(12, 1)).toBe("Steam sincronizada: 12 jogos novos e 1 com horas atualizadas.")
    expect(syncSummary(1, 0)).toBe("Steam sincronizada: 1 jogo novo.")
  })
})
