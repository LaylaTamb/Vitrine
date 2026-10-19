import { describe, expect, it } from "vitest"

import { hexToHsv, hsvToHex, parseHexColor } from "./color"
import { clockParts, joinDuration, MAX_DURATION_MINUTES, splitMinutes } from "./duration"
import { itemsUnder } from "./entry-folders"
import { isMissingColumn } from "./errors"
import { FIELD_TYPE_LABELS } from "./fields"
import { initialSortFor, normalizeSort } from "./filter"
import { defaultPublicOf, isPublic, privateAncestor, visibilityLabel } from "./privacy"
import { isPaletteColor, normalizeCategoryColor } from "./tags"
import { FIELD_TYPES, type EntryFolder } from "./types"

// ---------------------------------------------------------------------------
// cor livre da categoria
// ---------------------------------------------------------------------------

describe("cor da categoria", () => {
  it("lê HEX com ou sem #, de 3 ou 6 dígitos", () => {
    expect(parseHexColor("#2a9d8f")).toBe("#2A9D8F")
    expect(parseHexColor("2A9D8F")).toBe("#2A9D8F")
    expect(parseHexColor(" #abc ")).toBe("#AABBCC")
    expect(parseHexColor("#12345")).toBeNull()
    expect(parseHexColor("roxo")).toBeNull()
    expect(parseHexColor(null)).toBeNull()
  })

  it("aceita qualquer cor HEX na categoria, além das 8 da paleta", () => {
    expect(normalizeCategoryColor("#B98CC2")).toBe("#B98CC2")
    expect(normalizeCategoryColor("#2a9d8f")).toBe("#2A9D8F")
    expect(normalizeCategoryColor("")).toBeNull()
    expect(normalizeCategoryColor(null)).toBeNull()
    expect(normalizeCategoryColor("url(javascript:alert(1))")).toBeNull()
    expect(isPaletteColor("#b98cc2")).toBe(true)
    expect(isPaletteColor("#2A9D8F")).toBe(false)
  })

  it("vai e volta entre HEX e a roda sem perder a cor", () => {
    for (const hex of ["#FF0000", "#00FF00", "#0000FF", "#2A9D8F", "#B98CC2", "#FFFFFF", "#000000"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 })
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00FF00")
    expect(hsvToHex({ h: 480, s: 2, v: -1 })).toBe("#000000")
  })
})

// ---------------------------------------------------------------------------
// duração em horas e minutos
// ---------------------------------------------------------------------------

describe("duração", () => {
  it("guarda minutos e mostra horas e minutos, inclusive acima de 60", () => {
    expect(splitMinutes(95)).toEqual({ hours: 1, minutes: 35 })
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 })
    expect(joinDuration(2, 15)).toBe(135)
    // minuto acima de 59 vira hora
    expect(joinDuration(1, 75)).toBe(135)
    expect(clockParts("135")).toEqual({ hours: "02", minutes: "15" })
    expect(clockParts("")).toEqual({ hours: "", minutes: "" })
  })

  it("para em 999:59 e não aceita negativo", () => {
    expect(joinDuration(999, 59)).toBe(MAX_DURATION_MINUTES)
    expect(joinDuration(1200, 0)).toBe(MAX_DURATION_MINUTES)
    expect(splitMinutes(-5)).toEqual({ hours: 0, minutes: 0 })
    expect(clockParts(String(MAX_DURATION_MINUTES))).toEqual({ hours: "999", minutes: "59" })
  })
})

// ---------------------------------------------------------------------------
// estrutura: ordem dos tipos e ordem padrão
// ---------------------------------------------------------------------------

describe("estrutura da categoria", () => {
  it("oferece os tipos de campo na ordem pedida", () => {
    expect(FIELD_TYPES.map((type) => FIELD_TYPE_LABELS[type])).toEqual([
      "Estrela (0–5)",
      "Data",
      "Texto",
      "Número inteiro",
      "Número com vírgula",
      "Duração (h:min)",
      "Moeda",
      "Lista de opções",
      "Localização (mapa)",
    ])
  })

  it("categoria nova abre pela nota maior — sem estrelas, pelas recentes", () => {
    expect(initialSortFor(true)).toBe("rating_desc")
    expect(initialSortFor(false)).toBe("recent")
    expect(normalizeSort(undefined)).toBe("rating_desc")
    expect(normalizeSort(undefined, false)).toBe("recent")
    expect(normalizeSort("name_asc")).toBe("name_asc")
  })
})

// ---------------------------------------------------------------------------
// Números: a pasta aberta com as subpastas
// ---------------------------------------------------------------------------

describe("recorte dos Números", () => {
  const folder = (id: string, parent: string | null): EntryFolder => ({
    id,
    owner_id: "u1",
    category_id: "c1",
    name: id,
    parent_folder_id: parent,
    display_order: 0,
    created_at: "",
  })
  const folders = [folder("japoneses", null), folder("ramen", "japoneses"), folder("pizza", null)]
  const items = [
    { id: "raiz", folderId: null },
    { id: "sushi", folderId: "japoneses" },
    { id: "aizome", folderId: "ramen" },
    { id: "braz", folderId: "pizza" },
  ]

  it("na raiz, conta a categoria inteira", () => {
    expect(itemsUnder(items, folders, null).map((item) => item.id)).toEqual([
      "raiz",
      "sushi",
      "aizome",
      "braz",
    ])
  })

  it("numa subpasta, conta ela e as de dentro", () => {
    expect(itemsUnder(items, folders, "japoneses").map((item) => item.id)).toEqual([
      "sushi",
      "aizome",
    ])
    expect(itemsUnder(items, folders, "pizza").map((item) => item.id)).toEqual(["braz"])
  })
})

// ---------------------------------------------------------------------------
// privacidade
// ---------------------------------------------------------------------------

describe("privacidade", () => {
  it("o que não tem a coluna (antes da migração 12) é público", () => {
    expect(isPublic({})).toBe(true)
    expect(isPublic({ is_public: null })).toBe(true)
    expect(isPublic({ is_public: true })).toBe(true)
    expect(isPublic({ is_public: false })).toBe(false)
    expect(defaultPublicOf(null)).toBe(true)
    expect(defaultPublicOf({})).toBe(true)
    expect(defaultPublicOf({ default_public: false })).toBe(false)
  })

  it("acha a pasta privada que esconde o que está dentro", () => {
    const folders = [
      { id: "pessoal", name: "Pessoal", parent_folder_id: null, is_public: false },
      { id: "saude", name: "Saúde", parent_folder_id: "pessoal", is_public: true },
      { id: "cultura", name: "Cultura", parent_folder_id: null, is_public: true },
    ]
    expect(privateAncestor(folders, "saude")?.name).toBe("Pessoal")
    expect(privateAncestor(folders, "pessoal")?.name).toBe("Pessoal")
    expect(privateAncestor(folders, "cultura")).toBeNull()
    expect(privateAncestor(folders, null)).toBeNull()
  })

  it("aguenta ciclo na árvore sem travar", () => {
    const loop = [
      { id: "a", name: "A", parent_folder_id: "b" },
      { id: "b", name: "B", parent_folder_id: "a" },
    ]
    expect(privateAncestor(loop, "a")).toBeNull()
  })

  it("diz o estado em palavras", () => {
    expect(visibilityLabel("category", false)).toBe("Categoria privada: só você vê")
    expect(visibilityLabel("folder", true)).toBe("Pasta pública: quem tem acesso ao app vê")
  })

  it("reconhece a coluna que o banco ainda não tem", () => {
    expect(isMissingColumn({ code: "42703", message: 'column "is_public" does not exist' })).toBe(true)
    expect(
      isMissingColumn({
        code: "PGRST204",
        message: "Could not find the 'is_public' column of 'categories' in the schema cache",
      })
    ).toBe(true)
    expect(isMissingColumn({ code: "23505", message: "duplicate key value" })).toBe(false)
  })
})
