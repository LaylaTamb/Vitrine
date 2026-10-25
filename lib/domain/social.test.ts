import { describe, expect, it } from "vitest"

import {
  areFriends,
  followButtonLabel,
  notificationHref,
  notificationText,
  timeAgo,
} from "./social"

describe("seguir e amigos", () => {
  it("amigos são os que se seguem", () => {
    expect(areFriends({ following: true, followsMe: true })).toBe(true)
    expect(areFriends({ following: true, followsMe: false })).toBe(false)
    expect(areFriends({ following: false, followsMe: true })).toBe(false)
  })

  it("o botão diz o que acontece", () => {
    expect(followButtonLabel({ following: false, followsMe: false })).toBe("Seguir")
    expect(followButtonLabel({ following: false, followsMe: true })).toBe("Seguir de volta")
    expect(followButtonLabel({ following: true, followsMe: true })).toBe("Seguindo")
  })
})

describe("notificações", () => {
  const actor = { username: "ana", display_name: "Ana", avatar_url: null }

  it("novo seguidor, e quando vira amizade", () => {
    expect(notificationText({ type: "new_follower", payload: {}, actor })).toBe(
      "@ana começou a seguir você."
    )
    expect(notificationText({ type: "new_follower", payload: { mutual: true }, actor })).toBe(
      "@ana seguiu você de volta — agora vocês são amigos."
    )
  })

  it("importação concluída", () => {
    expect(
      notificationText({
        type: "import_done",
        payload: { source: "google", added: 245, pending: 120 },
        actor: null,
      })
    ).toBe("Importação do Google Maps concluída: 245 itens novos (120 ainda sem lugar no mapa).")
    expect(
      notificationText({ type: "import_done", payload: { source: "letterboxd", added: 1 }, actor: null })
    ).toBe("Importação do Letterboxd concluída: 1 item novo.")
  })

  it("match: convite, cancelado, pronto — e o destino do toque", () => {
    expect(notificationText({ type: "match_invite", payload: { size: 4 }, actor })).toBe(
      "@ana chamou você para um match com 4 pessoas."
    )
    expect(notificationText({ type: "match_invite", payload: { size: 2 }, actor })).toBe(
      "@ana chamou você para um match."
    )
    expect(notificationText({ type: "match_canceled", payload: {}, actor })).toBe(
      "@ana recusou o match, e ele foi cancelado."
    )
    expect(notificationText({ type: "match_ready", payload: {}, actor: null })).toBe(
      "Todo mundo aceitou: o seu match está pronto."
    )
    const href = (username: string) => `/v/${username}`
    expect(notificationHref({ type: "match_invite", actor }, href)).toBe("/matches")
    expect(notificationHref({ type: "new_follower", actor }, href)).toBe("/v/ana")
    expect(notificationHref({ type: "import_done", actor: null }, href)).toBe("/perfil")
  })

  it("amigos pelo QR", () => {
    expect(notificationText({ type: "qr_friend", payload: {}, actor })).toBe(
      "Você e @ana viraram amigos pelo QR."
    )
  })

  it("tipo desconhecido ou sem autor ainda vira frase", () => {
    expect(notificationText({ type: "outra_coisa", payload: {}, actor: null })).toBe(
      "Alguém fez algo novo no Vitrine."
    )
  })

  it("diz há quanto tempo", () => {
    const now = new Date("2026-10-21T15:00:00Z")
    expect(timeAgo("2026-10-21T14:59:30Z", now)).toBe("agora")
    expect(timeAgo("2026-10-21T14:55:00Z", now)).toBe("há 5 min")
    expect(timeAgo("2026-10-21T12:00:00Z", now)).toBe("há 3 h")
    expect(timeAgo("2026-10-20T14:00:00Z", now)).toBe("há 1 dia")
    expect(timeAgo("2026-10-18T15:00:00Z", now)).toBe("há 3 dias")
    expect(timeAgo("2026-10-01T15:00:00Z", now)).toBe("01/10")
  })
})
