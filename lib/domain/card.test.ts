import { describe, expect, it } from "vitest"

import {
  bannerFrom,
  cardCategoryOptions,
  clampBannerPosition,
  cardHasContent,
  cleanCardIds,
  moveCardId,
  normalizeBannerUrl,
  normalizeSocialLink,
  parseProfileCard,
  socialInputValue,
  socialLinksFrom,
  SOCIAL_PROVIDERS,
} from "./card"

function value(provider: Parameters<typeof normalizeSocialLink>[0], raw: string) {
  const result = normalizeSocialLink(provider, raw)
  return result.ok ? result.value : `ERRO: ${result.error}`
}

describe("links das redes", () => {
  it("Instagram: @, nome solto ou link", () => {
    expect(value("instagram", "@Ana.Souza")).toBe("ana.souza")
    expect(value("instagram", "ana_souza")).toBe("ana_souza")
    expect(value("instagram", "https://www.instagram.com/ana.souza/?hl=pt")).toBe("ana.souza")
    expect(value("instagram", "instagram.com/ana")).toBe("ana")
    expect(value("instagram", "https://golpe.com/ana")).toMatch(/^ERRO/)
    expect(value("instagram", "ana souza")).toMatch(/^ERRO/)
  })

  it("X: aceita os links antigos do Twitter", () => {
    expect(value("x", "@Ana_S")).toBe("ana_s")
    expect(value("x", "https://twitter.com/ana_s/status/1")).toBe("ana_s")
    expect(value("x", "x.com/ana")).toBe("ana")
    expect(value("x", "nome_comprido_demais_aqui")).toMatch(/^ERRO/)
  })

  it("Discord: nome de usuário ou convite", () => {
    expect(value("discord", "@Ana.S")).toBe("ana.s")
    expect(value("discord", "https://discord.gg/AbC-12")).toBe("https://discord.gg/AbC-12")
    expect(value("discord", "discord.com/invite/AbC12")).toBe("https://discord.gg/AbC12")
    expect(value("discord", "https://discord.com/channels/1/2")).toMatch(/^ERRO/)
  })

  it("Spotify: só links do open.spotify.com (ou o URI do app)", () => {
    expect(value("spotify", "https://open.spotify.com/intl-pt/playlist/37i9dQZF1DX?si=abc")).toBe(
      "https://open.spotify.com/playlist/37i9dQZF1DX"
    )
    expect(value("spotify", "spotify:artist:0OdUWJ0sBjDrqHygGUXeCF")).toBe(
      "https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF"
    )
    expect(value("spotify", "@ana")).toMatch(/^ERRO/)
    expect(value("spotify", "https://open.spotify.com/track/1")).toMatch(/^ERRO/)
  })

  it("YouTube: @ do canal ou link", () => {
    expect(value("youtube", "@Canal.Ana")).toBe("https://www.youtube.com/@Canal.Ana")
    expect(value("youtube", "https://m.youtube.com/@ana/videos")).toBe(
      "https://www.youtube.com/@ana"
    )
    expect(value("youtube", "youtube.com/channel/UC123abc")).toBe(
      "https://www.youtube.com/channel/UC123abc"
    )
    expect(value("youtube", "https://youtube.com/watch?v=1")).toMatch(/^ERRO/)
  })

  it("vazio apaga; javascript: nunca passa", () => {
    expect(normalizeSocialLink("instagram", "  ")).toEqual({ ok: true, value: null })
    for (const provider of SOCIAL_PROVIDERS) {
      expect(value(provider, "javascript:alert(1)")).toMatch(/^ERRO/)
    }
  })

  it("normalizar o que já foi normalizado não muda nada", () => {
    const samples = {
      instagram: "@Ana",
      x: "twitter.com/ana",
      discord: "discord.gg/abc",
      spotify: "spotify:user:ana",
      youtube: "@ana",
    } as const
    for (const provider of SOCIAL_PROVIDERS) {
      const once = value(provider, samples[provider]) as string
      expect(value(provider, once)).toBe(once)
      expect(value(provider, socialInputValue(provider, once))).toBe(once)
    }
  })

  it("ao ler, descarta o que não fecha e mantém a ordem das redes", () => {
    expect(
      socialLinksFrom({
        youtube: "https://www.youtube.com/@ana",
        instagram: "ana",
        x: "javascript:alert(1)",
        discord: "ana.s",
        outra: "x",
      })
    ).toEqual([
      { provider: "instagram", label: "@ana", href: "https://www.instagram.com/ana/" },
      { provider: "discord", label: "ana.s", href: null },
      { provider: "youtube", label: "@ana", href: "https://www.youtube.com/@ana" },
    ])
    expect(socialLinksFrom(null)).toEqual([])
    expect(socialLinksFrom(["ana"])).toEqual([])
  })
})

describe("categorias do cartão", () => {
  const folders = [
    { id: "p", name: "Pessoal", parent_folder_id: null, visibility: "private" as const },
  ]
  const categories = [
    { id: "a", folder_id: null, visibility: "public" as const },
    { id: "b", folder_id: "p", visibility: "public" as const },
    { id: "c", folder_id: null, visibility: "friends" as const },
    { id: "d", folder_id: null, visibility: "public" as const, kind: "inbox" as const },
  ]

  it("só as públicas de fato, fora a A organizar", () => {
    expect(cardCategoryOptions(categories, folders).map((category) => category.id)).toEqual(["a"])
  })

  it("sem repetir, no máximo 5, e reordena", () => {
    expect(cleanCardIds(["a", "b", "a", "c", "d", "e", "f"])).toEqual(["a", "b", "c", "d", "e"])
    expect(moveCardId(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"])
    expect(moveCardId(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"])
  })
})

describe("banner", () => {
  it("o link: vazio tira, só http(s)", () => {
    expect(normalizeBannerUrl("  ")).toEqual({ ok: true, value: null })
    expect(normalizeBannerUrl(" https://i.imgur.com/a.png ")).toEqual({
      ok: true,
      value: "https://i.imgur.com/a.png",
    })
    expect(normalizeBannerUrl("javascript:alert(1)").ok).toBe(false)
    expect(normalizeBannerUrl("não é link").ok).toBe(false)
  })

  it("a posição fica entre 0 e 100", () => {
    expect(clampBannerPosition(30.6)).toBe(31)
    expect(clampBannerPosition(-5)).toBe(0)
    expect(clampBannerPosition(250)).toBe(100)
    expect(clampBannerPosition("x")).toBe(50)
  })

  it("lido do banco: link estranho fica de fora", () => {
    expect(bannerFrom({ url: "https://x.com/b.jpg", position: 20 })).toEqual({
      url: "https://x.com/b.jpg",
      position: 20,
    })
    expect(bannerFrom({ url: "data:image/png;base64,AAA", position: 20 })).toBeNull()
    expect(bannerFrom(null)).toBeNull()
  })
})

describe("cartão lido do banco", () => {
  it("confere campo a campo", () => {
    const card = parseProfileCard({
      profile: { id: "1", username: "ana", display_name: "", avatar_url: null },
      bio: "x".repeat(300),
      social_links: { instagram: "ana" },
      categories: [
        {
          id: "c1",
          name: "Filmes",
          icon: "🎬",
          rating_enabled: true,
          total: 12,
          top: [{ id: "e1", name: "Duna", rating: 5 }, { id: "", name: "sem id" }, null],
        },
        { name: "sem id" },
      ],
    })
    expect(card?.bio).toHaveLength(220)
    expect(card?.banner).toBeNull()
    expect(card?.profile.display_name).toBeNull()
    expect(card?.links).toHaveLength(1)
    expect(card?.categories).toEqual([
      {
        id: "c1",
        name: "Filmes",
        icon: "🎬",
        color: null,
        rating_enabled: true,
        total: 12,
        top: [{ id: "e1", name: "Duna", rating: 5, image_url: null }],
      },
    ])
    expect(cardHasContent(card)).toBe(true)
  })

  it("sem perfil, sem cartão", () => {
    expect(parseProfileCard(null)).toBeNull()
    expect(parseProfileCard({ profile: { id: "1" } })).toBeNull()
    expect(
      cardHasContent(
        parseProfileCard({ profile: { id: "1", username: "ana" }, bio: " ", categories: [] })
      )
    ).toBe(false)
  })
})
