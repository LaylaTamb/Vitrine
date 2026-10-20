import { describe, expect, it } from "vitest"

import { isQrToken, qrLink, redeemMessage, REDEEM_STATUSES, scannedProfilePath } from "./qr"

const TOKEN = "a".repeat(32) + "0123456789abcdef".repeat(2)

describe("link do QR", () => {
  it("leva ao perfil, com o código quando é para virar amigo", () => {
    expect(qrLink("https://vitrine.app", "ana", TOKEN)).toBe(
      `https://vitrine.app/v/ana?qr=${TOKEN}`
    )
    expect(qrLink("https://vitrine.app/", "ana")).toBe("https://vitrine.app/v/ana")
  })

  it("só aceita o código no formato do banco", () => {
    expect(isQrToken(TOKEN)).toBe(true)
    expect(isQrToken(TOKEN.toUpperCase())).toBe(false)
    expect(isQrToken(TOKEN.slice(1))).toBe(false)
    expect(isQrToken(null)).toBe(false)
  })
})

describe("QR lido pela câmera", () => {
  const origins = ["http://localhost:3000", "https://vitrine.app"]

  it("abre o perfil deste site, com o código", () => {
    expect(scannedProfilePath(`https://vitrine.app/v/ana?qr=${TOKEN}`, origins)).toBe(
      `/v/ana?qr=${TOKEN}`
    )
    expect(scannedProfilePath(` http://localhost:3000/v/Ana/ `, origins)).toBe("/v/ana")
  })

  it("descarta código estranho, mas ainda abre o perfil", () => {
    expect(scannedProfilePath("https://vitrine.app/v/ana?qr=<script>", origins)).toBe("/v/ana")
  })

  it("nunca leva para fora do Vitrine nem para outra página", () => {
    expect(scannedProfilePath(`https://golpe.com/v/ana?qr=${TOKEN}`, origins)).toBeNull()
    expect(scannedProfilePath("https://vitrine.app.golpe.com/v/ana", origins)).toBeNull()
    expect(scannedProfilePath("https://vitrine.app/configuracoes", origins)).toBeNull()
    expect(scannedProfilePath("https://vitrine.app/v/ana/seguidores", origins)).toBeNull()
    expect(scannedProfilePath("https://vitrine.app/v/a", origins)).toBeNull()
    expect(scannedProfilePath("javascript:alert(1)", origins)).toBeNull()
    expect(scannedProfilePath("um texto qualquer", origins)).toBeNull()
    expect(scannedProfilePath("https://vitrine.app/v/ana", ["não é endereço"])).toBeNull()
  })
})

describe("frases depois de escanear", () => {
  it("tem uma para cada resposta do banco", () => {
    for (const status of REDEEM_STATUSES) {
      expect(redeemMessage(status, "ana").title.length).toBeGreaterThan(0)
    }
    expect(redeemMessage("friends", "ana")).toEqual({
      title: "Agora vocês são amigos",
      description: "Você e @ana se seguem: o que for de Amigos aparece para os dois.",
      good: true,
    })
    expect(redeemMessage("invalid", "ana").good).toBe(false)
  })
})
