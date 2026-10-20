import { describe, expect, it } from "vitest"

import {
  defaultVisibilityOf,
  effectiveVisibility,
  mostRestrictive,
  needsPublicNotice,
  restrictingAncestor,
  restrictionNote,
  visibilityLabel,
  visibilityOf,
  visibilityOptions,
} from "./privacy"

describe("nível de visibilidade", () => {
  it("lê o nível novo e, antes da migração 14, o is_public do 12", () => {
    expect(visibilityOf({ visibility: "friends", is_public: false })).toBe("friends")
    expect(visibilityOf({ visibility: "public" })).toBe("public")
    expect(visibilityOf({ is_public: false })).toBe("private")
    expect(visibilityOf({ is_public: true })).toBe("public")
    // antes do 12: tudo público, como sempre foi
    expect(visibilityOf({})).toBe("public")
    expect(visibilityOf(null)).toBe("public")
    // valor estranho no banco não vira nível
    expect(visibilityOf({ visibility: "segredo", is_public: false })).toBe("private")
  })

  it("lê o padrão do perfil do mesmo jeito", () => {
    expect(defaultVisibilityOf({ default_visibility: "friends", default_public: false })).toBe(
      "friends"
    )
    expect(defaultVisibilityOf({ default_public: false })).toBe("private")
    expect(defaultVisibilityOf({})).toBe("public")
    expect(defaultVisibilityOf(null)).toBe("public")
  })

  it("o mais restrito ganha", () => {
    expect(mostRestrictive("public", "friends")).toBe("friends")
    expect(mostRestrictive("private", "friends")).toBe("private")
    expect(mostRestrictive("public", "public")).toBe("public")
  })

  it("oferece os três níveis, do mais aberto ao mais fechado", () => {
    expect(visibilityOptions()).toEqual(["public", "friends", "private"])
    expect(visibilityOptions("private")).toEqual(["public", "friends", "private"])
  })
})

describe("caminho de pastas", () => {
  const folders = [
    { id: "pessoal", name: "Pessoal", parent_folder_id: null, visibility: "private" as const },
    { id: "saude", name: "Saúde", parent_folder_id: "pessoal", visibility: "public" as const },
    { id: "turma", name: "Turma", parent_folder_id: null, visibility: "friends" as const },
    { id: "bares", name: "Bares", parent_folder_id: "turma", visibility: "public" as const },
    { id: "fundo", name: "Fundo", parent_folder_id: "bares", visibility: "private" as const },
    { id: "cultura", name: "Cultura", parent_folder_id: null, is_public: true },
  ]

  it("acha a pasta que fecha mais do que o nível escolhido", () => {
    expect(restrictingAncestor(folders, "saude", "public")).toEqual({
      folder: { id: "pessoal", name: "Pessoal" },
      visibility: "private",
    })
    expect(restrictingAncestor(folders, "bares", "public")?.folder.name).toBe("Turma")
    expect(restrictingAncestor(folders, "bares", "public")?.visibility).toBe("friends")
    // a mais restrita do caminho, não a primeira que fecha
    expect(restrictingAncestor(folders, "fundo", "public")?.folder.name).toBe("Fundo")
  })

  it("não avisa quando o caminho não fecha nada além do nível escolhido", () => {
    expect(restrictingAncestor(folders, "bares", "friends")).toBeNull()
    expect(restrictingAncestor(folders, "saude", "private")).toBeNull()
    expect(restrictingAncestor(folders, "cultura", "public")).toBeNull()
    expect(restrictingAncestor(folders, null, "public")).toBeNull()
  })

  it("diz o nível que vale de fato", () => {
    expect(effectiveVisibility("public", folders, "bares")).toBe("friends")
    expect(effectiveVisibility("private", folders, "bares")).toBe("private")
    expect(effectiveVisibility("public", folders, null)).toBe("public")
  })

  it("aguenta ciclo na árvore sem travar", () => {
    const loop = [
      { id: "a", name: "A", parent_folder_id: "b" },
      { id: "b", name: "B", parent_folder_id: "a" },
    ]
    expect(restrictingAncestor(loop, "a", "public")).toBeNull()
  })
})

describe("frases", () => {
  it("diz o estado em palavras", () => {
    expect(visibilityLabel("category", "private")).toBe("Categoria privada: só você vê")
    expect(visibilityLabel("folder", "public")).toBe(
      "Pasta pública: qualquer pessoa vê, mesmo sem conta"
    )
  })

  it("explica a pasta que fecha mais", () => {
    expect(
      restrictionNote("folder", { folder: { id: "x", name: "Pessoal" }, visibility: "private" })
    ).toBe("Esta pasta está dentro de “Pessoal”, que é privada: ninguém mais vê o que tem aqui.")
    expect(
      restrictionNote("category", { folder: { id: "x", name: "Turma" }, visibility: "friends" })
    ).toBe(
      "Esta categoria está dentro de “Turma”, que é só para amigos: só seus amigos veem os itens dela."
    )
  })
})

describe("aviso de que Pública agora é na internet", () => {
  const folders = [
    { id: "pessoal", name: "Pessoal", parent_folder_id: null, visibility: "private" as const },
  ]

  it("aparece para quem ainda não viu e tem algo público de fato", () => {
    expect(
      needsPublicNotice({ public_notice_seen_at: null }, [{ folder_id: null, visibility: "public" }], [])
    ).toBe(true)
  })

  it("não aparece para quem já viu, nem sem a migração 14", () => {
    const categories = [{ folder_id: null, visibility: "public" as const }]
    expect(needsPublicNotice({ public_notice_seen_at: "2026-10-19T12:00:00Z" }, categories, [])).toBe(
      false
    )
    expect(needsPublicNotice({}, categories, [])).toBe(false)
    expect(needsPublicNotice(null, categories, [])).toBe(false)
  })

  it("não conta categoria pública escondida por pasta privada", () => {
    expect(
      needsPublicNotice(
        { public_notice_seen_at: null },
        [
          { folder_id: "pessoal", visibility: "public" },
          { folder_id: null, visibility: "private" },
        ],
        folders
      )
    ).toBe(false)
  })
})
