import { describe, expect, it } from "vitest"

import { bannerPositionAfterDrag, changedProfileParts, type ProfileDraft } from "./profile-edit"

const SAVED: ProfileDraft = {
  bannerUrl: "https://exemplo.com/b.jpg",
  bannerPosition: 50,
  avatarUrl: "",
  displayName: "Lay",
  bio: "oi",
  categoryIds: ["a", "b"],
  links: { instagram: "@lay", x: "", discord: "", spotify: "", youtube: "" },
}

describe("editar perfil", () => {
  it("sem mudança, nada a salvar", () => {
    expect(changedProfileParts(SAVED, structuredClone(SAVED))).toEqual([])
    // Espaço nas pontas não conta.
    expect(changedProfileParts(SAVED, { ...SAVED, displayName: " Lay " })).toEqual([])
  })

  it("aponta cada parte que mudou, na ordem da tela", () => {
    const draft: ProfileDraft = {
      ...SAVED,
      bannerPosition: 20,
      bio: "oi!",
      categoryIds: ["b", "a"],
      links: { ...SAVED.links, x: "@lay" },
    }
    expect(changedProfileParts(SAVED, draft)).toEqual(["banner", "bio", "highlights", "social"])
    expect(changedProfileParts(SAVED, { ...SAVED, avatarUrl: "https://x.com/f.jpg" })).toEqual([
      "identity",
    ])
  })

  it("sem banner, a posição não importa", () => {
    const none = { ...SAVED, bannerUrl: "" }
    expect(changedProfileParts(none, { ...none, bannerPosition: 10 })).toEqual([])
  })

  it("o banner acompanha o dedo e para nas pontas", () => {
    // Sobra de 200 px: subir 50 px mostra 25% mais para o pé.
    expect(bannerPositionAfterDrag(50, -50, 200)).toBe(75)
    expect(bannerPositionAfterDrag(50, 500, 200)).toBe(0)
    expect(bannerPositionAfterDrag(50, -500, 200)).toBe(100)
    expect(bannerPositionAfterDrag(40, -50, 0)).toBe(40)
  })
})
