import { describe, expect, it } from "vitest"

import {
  breadcrumbOf,
  categoriesOf,
  descendantFolderIds,
  folderTotals,
  foldersOf,
  moveTargets,
} from "./collections"
import { translateError } from "./errors"
import {
  coerceCustomFields,
  coerceFieldValue,
  diffEstrutura,
  diffFieldOptions,
  newFieldId,
  normalizeCurrency,
  parseEstrutura,
  parseEstruturaJSON,
  parseOptions,
  serializeEstrutura,
  validateField,
} from "./fields"
import {
  applyCategoryFilter,
  applyGlobalFilter,
  EMPTY_CATEGORY_FILTER,
  EMPTY_GLOBAL_FILTER,
  groupByCategory,
  isCategoryFilterActive,
  tagsPresentIn,
  unifyFields,
} from "./filter"
import { formatDateBR, formatDecimal, formatMinutes, formatRating, plural } from "./format"
import { migrateCustomFields } from "./migrate"
import { computeStats } from "./stats"
import type { Category, Entry, Estrutura, Folder, Tag } from "./types"
import { formatFieldValue, imageTransformOf, toView } from "./view"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TAGS: Tag[] = [
  { id: "t1", name: "Japonês", color: "#B98CC2" },
  { id: "t2", name: "Barato", color: "#8FC9A6" },
  { id: "t3", name: "Com amigos", color: "#8FB3C9" },
]
const tagsById = new Map(TAGS.map((tag) => [tag.id, tag]))

const ESTRUTURA: Estrutura = [
  { id: "f_visit", nome: "Visitas", tipo: "int" },
  { id: "f_atend", nome: "Atendimento", tipo: "star" },
  { id: "f_esper", nome: "Tempo de Espera", tipo: "time" },
  { id: "f_pedid", nome: "Pedido", tipo: "str" },
  { id: "f_modo", nome: "Modo", tipo: "select", opcoes: ["Salão", "Delivery"] },
  { id: "f_quand", nome: "Quando", tipo: "date" },
]

function entry(partial: Partial<Entry> & { id: string; name: string }): Entry {
  return {
    category_id: "c1",
    owner_id: "u1",
    rating: null,
    image_url: null,
    image_display: {},
    custom_fields: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------

describe("format", () => {
  it("formata nota com vírgula decimal", () => {
    expect(formatRating(5)).toBe("5")
    expect(formatRating(4.5)).toBe("4,5")
    expect(formatRating(0)).toBe("0")
    expect(formatRating(null)).toBe("")
  })

  it("formata duração em minutos", () => {
    expect(formatMinutes(90)).toBe("1h 30min")
    expect(formatMinutes(120)).toBe("2h")
    expect(formatMinutes(45)).toBe("45 min")
    expect(formatMinutes(0)).toBe("")
    expect(formatMinutes(null)).toBe("")
  })

  it("formata data no padrão brasileiro", () => {
    expect(formatDateBR("2024-05-03")).toBe("03/05/2024")
    expect(formatDateBR("03/05/2024")).toBe("")
    expect(formatDateBR(null)).toBe("")
  })

  it("pluraliza", () => {
    expect(plural(1, "item", "itens")).toBe("1 item")
    expect(plural(3, "item", "itens")).toBe("3 itens")
    expect(plural(0, "item", "itens")).toBe("0 itens")
  })

  it("não come zeros de números inteiros grandes", () => {
    expect(formatDecimal(100, 0)).toBe("100")
    expect(formatDecimal(4.25, 1)).toBe("4,3")
    expect(formatDecimal(4, 1)).toBe("4")
  })
})

// ---------------------------------------------------------------------------
// fields
// ---------------------------------------------------------------------------

describe("fields", () => {
  it("gera id no formato f_ + 6 alfanuméricos", () => {
    for (let i = 0; i < 50; i++) {
      expect(newFieldId()).toMatch(/^f_[a-z0-9]{6}$/)
    }
    expect(new Set(Array.from({ length: 200 }, newFieldId)).size).toBeGreaterThan(190)
  })

  it("coage valores conforme o tipo do campo", () => {
    const star = ESTRUTURA[1]!
    const int = ESTRUTURA[0]!
    const time = ESTRUTURA[2]!
    const date = ESTRUTURA[5]!
    const select = ESTRUTURA[4]!

    expect(coerceFieldValue(star, "4.5")).toBe(4.5)
    expect(coerceFieldValue(star, "4,5")).toBe(4.5)
    expect(coerceFieldValue(star, "0")).toBeNull()
    expect(coerceFieldValue(star, "9")).toBe(5)
    expect(coerceFieldValue(int, "12.7")).toBe(12)
    expect(coerceFieldValue(time, "90")).toBe(90)
    expect(coerceFieldValue(date, "2024-05-03")).toBe("2024-05-03")
    expect(coerceFieldValue(date, "03/05/2024")).toBeNull()
    expect(coerceFieldValue(select, "Salão")).toBe("Salão")
    expect(coerceFieldValue(select, "Drive-thru")).toBeNull()
  })

  it("coage decimal e moeda com vírgula, sem truncar", () => {
    const decimal = { id: "f_dec", nome: "Peso", tipo: "decimal" as const }
    const currency = { id: "f_cur", nome: "Preço", tipo: "currency" as const, moeda: "€" }

    expect(coerceFieldValue(decimal, "4,25")).toBe(4.25)
    expect(coerceFieldValue(decimal, "4.2")).toBe(4.2)
    expect(coerceFieldValue(currency, "49,9")).toBe(49.9)
    expect(coerceFieldValue(currency, "49,999")).toBe(50) // arredonda em 2 casas
    expect(coerceFieldValue(currency, "abc")).toBeNull()
  })

  it("só aceita moeda da lista; qualquer outra coisa vira R$", () => {
    expect(normalizeCurrency("€")).toBe("€")
    expect(normalizeCurrency("won")).toBe("R$")
    expect(normalizeCurrency(undefined)).toBe("R$")
  })

  it("exibe moeda com o símbolo do campo, e decimal com 2 casas", () => {
    const currency = { id: "f_cur", nome: "Preço", tipo: "currency" as const, moeda: "$" }
    const decimal = { id: "f_dec", nome: "Peso", tipo: "decimal" as const }
    expect(formatFieldValue(currency, 49.9)).toBe("$ 49,9")
    expect(formatFieldValue(decimal, 4.5)).toBe("4,5")
  })

  it("não grava valor vazio nem campo que saiu da estrutura", () => {
    const values = coerceCustomFields(ESTRUTURA, {
      f_visit: "3",
      f_pedid: "   ",
      f_atend: "",
      f_fantasma: "vai sumir",
    })
    expect(values).toEqual({ f_visit: 3 })
  })

  it("bloqueia nome reservado, duplicado e select sem opções", () => {
    expect(validateField(ESTRUTURA, "Avaliação", "str")).toBe(
      '"Avaliação" já existe em toda categoria.'
    )
    expect(validateField(ESTRUTURA, "avaliacao", "str")).toContain("já existe em toda categoria")
    expect(validateField(ESTRUTURA, "visitas", "int")).toContain("já tem um campo chamado")
    expect(validateField(ESTRUTURA, "Bebida", "select", [])).toContain("pelo menos uma opção")
    expect(validateField(ESTRUTURA, "Bebida", "str")).toBeNull()
    // renomear o próprio campo não colide consigo mesmo
    expect(validateField(ESTRUTURA, "Visitas", "int", [], "f_visit")).toBeNull()
  })

  it("lê opções separadas por vírgula, sem repetir", () => {
    expect(parseOptions("Salão, Delivery ,  salão ,, Balcão")).toEqual([
      "Salão",
      "Delivery",
      "Balcão",
    ])
  })

  it("lê opções uma por linha também, e pode misturar com vírgula", () => {
    expect(parseOptions("Salão\nDelivery\n\nBalcão")).toEqual(["Salão", "Delivery", "Balcão"])
    expect(parseOptions("Salão, Delivery\nBalcão")).toEqual(["Salão", "Delivery", "Balcão"])
  })

  it("aponta opção removida de um select que continua existindo", () => {
    const antes: Estrutura = [
      { id: "f_modo", nome: "Modo", tipo: "select", opcoes: ["Salão", "Delivery", "Balcão"] },
      { id: "f_nota", nome: "Nota", tipo: "star" },
    ]
    const depois: Estrutura = [
      { id: "f_modo", nome: "Modo", tipo: "select", opcoes: ["Salão"] },
      { id: "f_nota", nome: "Nota", tipo: "star" },
    ]
    expect(diffFieldOptions(antes, depois)).toEqual([
      { fieldId: "f_modo", nome: "Modo", removed: ["Delivery", "Balcão"] },
    ])
    // campo removido por inteiro não conta aqui — isso é diffEstrutura
    expect(diffFieldOptions(antes, [antes[1]!])).toEqual([])
    // nada mudou nas opções
    expect(diffFieldOptions(antes, antes)).toEqual([])
  })

  it("descarta campo torto ao ler a estrutura do banco", () => {
    const parsed = parseEstrutura([
      { id: "f_ok", nome: "Visitas", tipo: "int" },
      { id: "f_bad", nome: "Sem tipo" },
      { id: "f_bad2", nome: "Tipo inexistente", tipo: "lista" },
      { id: "f_sel", nome: "Modo", tipo: "select", opcoes: [] },
      "não é objeto",
    ])
    expect(parsed).toEqual([{ id: "f_ok", nome: "Visitas", tipo: "int" }])
  })

  describe("modo JSON", () => {
    it("aponta o campo com problema", () => {
      expect(parseEstruturaJSON("[{}]")).toEqual({
        ok: false,
        error: 'Campo 1: falta "nome".',
      })
      expect(parseEstruturaJSON('[{"nome":"Modo","tipo":"lista"}]')).toEqual({
        ok: false,
        error:
          'Campo "Modo": tipo "lista" não existe. Use um destes: star, int, decimal, currency, time, str, date, select.',
      })
      expect(
        parseEstruturaJSON('[{"nome":"Nota","tipo":"int"},{"nome":"Nota","tipo":"str"}]')
      ).toEqual({ ok: false, error: 'Campo "Nota" aparece duas vezes.' })
      expect(parseEstruturaJSON('[{"nome":"Modo","tipo":"select"}]')).toEqual({
        ok: false,
        error: 'Campo "Modo": select precisa de "opcoes".',
      })
      expect(parseEstruturaJSON("isso não é json").ok).toBe(false)
      expect(parseEstruturaJSON('{"nome":"x"}').ok).toBe(false)
    })

    it("preserva os ids conhecidos e gera id para campo novo", () => {
      const json = JSON.stringify([
        { id: "f_visit", nome: "Idas", tipo: "int" },
        { nome: "Bebida", tipo: "str" },
        { id: "f_inventado", nome: "Outro", tipo: "str" },
      ])
      const result = parseEstruturaJSON(json, ESTRUTURA)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // renomeado, mas com o mesmo id: nenhum valor é perdido
      expect(result.estrutura[0]).toEqual({ id: "f_visit", nome: "Idas", tipo: "int" })
      expect(result.estrutura[1]!.id).toMatch(/^f_[a-z0-9]{6}$/)
      // id desconhecido não é aceito de fora: vira um id novo
      expect(result.estrutura[2]!.id).not.toBe("f_inventado")
    })

    it("serializa e relê sem perder nada", () => {
      const round = parseEstruturaJSON(serializeEstrutura(ESTRUTURA), ESTRUTURA)
      expect(round.ok).toBe(true)
      if (round.ok) expect(round.estrutura).toEqual(ESTRUTURA)
    })
  })

  it("renomear não conta como adicionar nem remover", () => {
    const depois: Estrutura = [
      { id: "f_visit", nome: "Idas", tipo: "int" },
      { id: "f_novo", nome: "Bebida", tipo: "str" },
    ]
    const antes: Estrutura = [
      { id: "f_visit", nome: "Visitas", tipo: "int" },
      { id: "f_pedid", nome: "Pedido", tipo: "str" },
    ]
    const diff = diffEstrutura(antes, depois)
    expect(diff.added.map((f) => f.nome)).toEqual(["Bebida"])
    expect(diff.removed.map((f) => f.nome)).toEqual(["Pedido"])
    expect(diff.renamed).toEqual([{ from: "Visitas", to: "Idas" }])
  })
})

// ---------------------------------------------------------------------------
// toView
// ---------------------------------------------------------------------------

describe("toView", () => {
  const view = toView(
    {
      ...entry({
        id: "e1",
        name: "kinoshita",
        rating: 4.5,
        image_url: "https://exemplo.com/foto.jpg",
        image_display: { x: 30, y: 70, zoom: 1.25 },
        custom_fields: {
          f_visit: 3,
          f_atend: 4,
          f_esper: 90,
          f_pedid: "Omakase",
          f_modo: "Salão",
          f_fantasma: "campo que não existe mais",
        },
      }),
      entry_tags: [{ tag_id: "t1" }, { tag_id: "t2" }, { tag_id: "inexistente" }],
    },
    ESTRUTURA,
    tagsById,
    "Restaurantes"
  )

  it("resolve imagem, nota e inicial", () => {
    expect(view.initial).toBe("K")
    expect(view.hasImage).toBe(true)
    expect(view.imageTransform).toBe("translate(5.00%, -5.00%) scale(1.250)")
    expect(view.ratingLabel).toBe("4,5")
    expect(view.ratingPercent).toBe("90%")
    expect(view.hasRating).toBe(true)
  })

  it("resolve só as tags que existem", () => {
    expect(view.tags.map((tag) => tag.name)).toEqual(["Barato", "Japonês"])
  })

  it("exibe só os campos da estrutura, na ordem dela, já formatados", () => {
    expect(view.extras.map((extra) => [extra.label, extra.value])).toEqual([
      ["Visitas", "3"],
      ["Atendimento", "4"],
      ["Tempo de Espera", "1h 30min"],
      ["Pedido", "Omakase"],
      ["Modo", "Salão"],
    ])
    expect(view.extras.find((extra) => extra.label === "Atendimento")?.percent).toBe(80)
  })

  it("resume com os dois primeiros str/select preenchidos", () => {
    expect(view.summary).toBe("Omakase · Salão")
  })

  it("indexa nome, tags e valores para a busca", () => {
    expect(view.search).toContain("kinoshita")
    expect(view.search).toContain("japonês")
    expect(view.search).toContain("omakase")
    expect(view.search).not.toContain("campo que não existe mais")
  })

  it("trata item sem nada", () => {
    const vazio = toView(entry({ id: "e2", name: "sem nada" }), ESTRUTURA, tagsById, "Restaurantes")
    expect(vazio.ratingLabel).toBe("—")
    expect(vazio.ratingPercent).toBe("0%")
    expect(vazio.hasImage).toBe(false)
    expect(vazio.imageTransform).toBe("translate(0.00%, 0.00%) scale(1.000)")
    expect(vazio.extras).toEqual([])
    expect(vazio.summary).toBe("")
  })
})

// ---------------------------------------------------------------------------
// imageTransformOf — o pan tem que cobrir 0–100% de verdade nos dois eixos
// ---------------------------------------------------------------------------

describe("imageTransformOf", () => {
  it("sem zoom, não há para onde deslizar", () => {
    expect(imageTransformOf({ x: 0, y: 100, zoom: 1 })).toBe(
      "translate(0.00%, 0.00%) scale(1.000)"
    )
  })

  it("no zoom máximo, os extremos do slider alcançam o fim do respiro", () => {
    // slack = (3-1)/2 = 1 → 100% de deslocamento possível em cada eixo.
    expect(imageTransformOf({ x: 100, y: 0, zoom: 3 })).toBe(
      "translate(-100.00%, 100.00%) scale(3.000)"
    )
    expect(imageTransformOf({ x: 0, y: 100, zoom: 3 })).toBe(
      "translate(100.00%, -100.00%) scale(3.000)"
    )
  })
})

// ---------------------------------------------------------------------------
// filtro da categoria
// ---------------------------------------------------------------------------

describe("filtro da categoria", () => {
  const views = [
    toView(
      {
        ...entry({
          id: "a",
          name: "Alfa",
          rating: 5,
          created_at: "2024-03-01T00:00:00Z",
          custom_fields: { f_pedid: "Ramen" },
        }),
        entry_tags: [{ tag_id: "t1" }],
      },
      ESTRUTURA,
      tagsById,
      "Restaurantes"
    ),
    toView(
      {
        ...entry({ id: "b", name: "Beta", rating: 3, created_at: "2024-05-01T00:00:00Z" }),
        entry_tags: [{ tag_id: "t2" }],
      },
      ESTRUTURA,
      tagsById,
      "Restaurantes"
    ),
    toView(
      entry({ id: "c", name: "Gama", rating: null, created_at: "2024-04-01T00:00:00Z" }),
      ESTRUTURA,
      tagsById,
      "Restaurantes"
    ),
  ]

  it("ordena por adição recente por padrão", () => {
    expect(applyCategoryFilter(views, EMPTY_CATEGORY_FILTER).map((v) => v.id)).toEqual([
      "b",
      "c",
      "a",
    ])
  })

  it("manda item sem nota para o fim nas duas ordenações por nota", () => {
    expect(
      applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, sort: "rating_asc" }).map((v) => v.id)
    ).toEqual(["b", "a", "c"])
    expect(
      applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, sort: "rating_desc" }).map((v) => v.id)
    ).toEqual(["a", "b", "c"])
  })

  it("busca em nome, tag e valor de campo", () => {
    const byName = applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, query: "alf" })
    expect(byName.map((v) => v.id)).toEqual(["a"])
    const byTag = applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, query: "japonês" })
    expect(byTag.map((v) => v.id)).toEqual(["a"])
    const byField = applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, query: "ramen" })
    expect(byField.map((v) => v.id)).toEqual(["a"])
  })

  it("filtra por faixa de nota, excluindo quem não tem nota", () => {
    const result = applyCategoryFilter(views, { ...EMPTY_CATEGORY_FILTER, minRating: "4" })
    expect(result.map((v) => v.id)).toEqual(["a"])
  })

  it("combina tags com OR", () => {
    const result = applyCategoryFilter(views, {
      ...EMPTY_CATEGORY_FILTER,
      tagIds: ["t1", "t2"],
    })
    expect(result.map((v) => v.id).sort()).toEqual(["a", "b"])
  })

  it("sabe quando há filtro ativo — ordenação não conta", () => {
    expect(isCategoryFilterActive(EMPTY_CATEGORY_FILTER)).toBe(false)
    expect(isCategoryFilterActive({ ...EMPTY_CATEGORY_FILTER, sort: "name_asc" })).toBe(false)
    expect(isCategoryFilterActive({ ...EMPTY_CATEGORY_FILTER, query: "x" })).toBe(true)
  })

  it("lista só as tags presentes nos itens", () => {
    expect(tagsPresentIn(views).map((tag) => tag.id)).toEqual(["t2", "t1"])
  })
})

// ---------------------------------------------------------------------------
// filtro geral
// ---------------------------------------------------------------------------

describe("filtro geral", () => {
  const restaurantes: Category = {
    id: "c1",
    owner_id: "u1",
    name: "Restaurantes",
    icon: "🍽️",
    color: null,
    folder_id: null,
    display_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    estrutura: [
      { id: "r_nota", nome: "Comida", tipo: "star" },
      { id: "r_modo", nome: "Modo", tipo: "select", opcoes: ["Salão", "Delivery"] },
    ],
  }
  const bares: Category = {
    ...restaurantes,
    id: "c2",
    name: "Bares",
    icon: "🍺",
    display_order: 1,
    estrutura: [
      { id: "b_nota", nome: "comida", tipo: "star" },
      { id: "b_modo", nome: "Modo", tipo: "select", opcoes: ["Salão", "Balcão"] },
    ],
  }

  it("unifica campo de mesmo nome e tipo, e separa select de opções diferentes", () => {
    const unified = unifyFields([restaurantes, bares])
    const comida = unified.find((field) => field.nome.toLowerCase() === "comida")
    expect(comida?.categories.map((c) => c.categoryId)).toEqual(["c1", "c2"])

    const modos = unified.filter((field) => field.nome === "Modo")
    expect(modos).toHaveLength(2)
    // mesmo nome, identidades diferentes: rótulo desambiguado
    expect(modos.every((field) => field.label !== "Modo")).toBe(true)
    expect(modos.map((field) => field.label).sort()).toEqual([
      "Modo (Salão, Balcão)",
      "Modo (Salão, Delivery)",
    ])
  })

  it("deixa de fora quem não tem o campo ativo no filtro", () => {
    const unified = unifyFields([restaurantes, bares])
    const comida = unified.find((field) => field.nome.toLowerCase() === "comida")!

    const views = [
      toView(
        entry({ id: "a", name: "Com nota", category_id: "c1", custom_fields: { r_nota: 5 } }),
        restaurantes.estrutura,
        tagsById,
        "Restaurantes"
      ),
      toView(
        entry({ id: "b", name: "Sem nota", category_id: "c1" }),
        restaurantes.estrutura,
        tagsById,
        "Restaurantes"
      ),
      toView(
        entry({ id: "c", name: "Bar", category_id: "c2", custom_fields: { b_nota: 3 } }),
        bares.estrutura,
        tagsById,
        "Bares"
      ),
    ]

    const filtered = applyGlobalFilter(
      views,
      { ...EMPTY_GLOBAL_FILTER, fields: { [comida.key]: { min: "4", max: "", value: "" } } },
      unified
    )
    expect(filtered.map((view) => view.id)).toEqual(["a"])

    const grouped = groupByCategory(views, [restaurantes, bares])
    expect(grouped.map((group) => [group.categoryName, group.views.length])).toEqual([
      ["Restaurantes", 2],
      ["Bares", 1],
    ])
  })

  it("filtra por categoria — vazio é 'todas', marcada é só ela", () => {
    const views = [
      toView(entry({ id: "a", name: "Restaurante A", category_id: "c1" }), [], tagsById, "Restaurantes"),
      toView(entry({ id: "b", name: "Bar B", category_id: "c2" }), [], tagsById, "Bares"),
    ]

    expect(applyGlobalFilter(views, EMPTY_GLOBAL_FILTER, []).map((v) => v.id)).toEqual(["a", "b"])

    const soRestaurantes = applyGlobalFilter(
      views,
      { ...EMPTY_GLOBAL_FILTER, categoryIds: ["c1"] },
      []
    )
    expect(soRestaurantes.map((v) => v.id)).toEqual(["a"])
  })
})

// ---------------------------------------------------------------------------
// estatísticas
// ---------------------------------------------------------------------------

describe("estatísticas", () => {
  const views = [
    toView(
      {
        ...entry({
          id: "a",
          name: "A",
          rating: 5,
          custom_fields: { f_visit: 2, f_esper: 60, f_modo: "Salão" },
        }),
        entry_tags: [{ tag_id: "t1" }],
      },
      ESTRUTURA,
      tagsById,
      "Restaurantes"
    ),
    toView(
      {
        ...entry({
          id: "b",
          name: "B",
          rating: 4,
          custom_fields: { f_visit: 4, f_esper: 120, f_modo: "Salão" },
        }),
        entry_tags: [{ tag_id: "t1" }, { tag_id: "t2" }],
      },
      ESTRUTURA,
      tagsById,
      "Restaurantes"
    ),
    toView(entry({ id: "c", name: "C", rating: null }), ESTRUTURA, tagsById, "Restaurantes"),
  ]

  const stats = computeStats(views, ESTRUTURA)

  it("conta o recorte, a média e quantos têm nota", () => {
    expect(stats.total).toBe(3)
    expect(stats.ratedCount).toBe(2)
    expect(stats.average).toBe(4.5)
    expect(stats.averageLabel).toBe("4,5")
  })

  it("faz média dos numéricos e moda dos select, ignorando str e date", () => {
    const labels = stats.fields.map((field) => field.label)
    expect(labels).toEqual(["Visitas", "Tempo de Espera", "Modo"])

    const visitas = stats.fields.find((field) => field.label === "Visitas")!
    expect(visitas.value).toBe("3")
    expect(visitas.caption).toBe("média · 2 itens")

    const espera = stats.fields.find((field) => field.label === "Tempo de Espera")!
    expect(espera.value).toBe("1h 30min")

    const modo = stats.fields.find((field) => field.label === "Modo")!
    expect(modo.value).toBe("Salão")
    expect(modo.caption).toBe("mais comum · 2 itens")
  })

  it("distribui as notas em 10 baldes de meia estrela", () => {
    expect(stats.distribution).toHaveLength(10)
    expect(stats.distribution[0]!.label).toBe("5")
    expect(stats.distribution[0]!.count).toBe(1)
    expect(stats.distribution.at(-1)!.label).toBe("0,5")
    expect(stats.distribution.reduce((acc, bucket) => acc + bucket.count, 0)).toBe(2)
  })

  it("ranqueia as tags mais usadas", () => {
    expect(stats.topTags.map((item) => [item.tag.name, item.count])).toEqual([
      ["Japonês", 2],
      ["Barato", 1],
    ])
    expect(stats.topTags[0]!.percent).toBe(100)
  })

  it("aguenta recorte vazio", () => {
    const empty = computeStats([], ESTRUTURA)
    expect(empty.total).toBe(0)
    expect(empty.average).toBeNull()
    expect(empty.averageLabel).toBe("—")
    expect(empty.fields).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// coleções
// ---------------------------------------------------------------------------

describe("coleções", () => {
  const folders: Folder[] = [
    { id: "f1", owner_id: "u1", name: "Comida", parent_folder_id: null, display_order: 0, created_at: "" },
    { id: "f2", owner_id: "u1", name: "Fora", parent_folder_id: "f1", display_order: 0, created_at: "" },
    { id: "f3", owner_id: "u1", name: "Casa", parent_folder_id: "f1", display_order: 1, created_at: "" },
    { id: "f4", owner_id: "u1", name: "Cinema", parent_folder_id: null, display_order: 1, created_at: "" },
  ]
  const categories: Category[] = [
    { id: "c1", owner_id: "u1", name: "Restaurantes", icon: null, color: null, folder_id: "f2", display_order: 0, estrutura: [], created_at: "" },
    { id: "c2", owner_id: "u1", name: "Receitas", icon: null, color: null, folder_id: "f3", display_order: 0, estrutura: [], created_at: "" },
    { id: "c3", owner_id: "u1", name: "Filmes", icon: null, color: null, folder_id: null, display_order: 0, estrutura: [], created_at: "" },
  ]
  const counts = new Map([
    ["c1", 30],
    ["c2", 7],
    ["c3", 12],
  ])

  it("mostra só o nível atual", () => {
    expect(foldersOf(folders, null).map((f) => f.id)).toEqual(["f1", "f4"])
    expect(foldersOf(folders, "f1").map((f) => f.id)).toEqual(["f2", "f3"])
    expect(categoriesOf(categories, null).map((c) => c.id)).toEqual(["c3"])
    expect(categoriesOf(categories, "f2").map((c) => c.id)).toEqual(["c1"])
  })

  it("conta tudo que está abaixo da pasta, inclusive em subpastas", () => {
    const totals = folderTotals(folders, categories, counts)
    expect(totals.get("f1")).toEqual({ categories: 2, entries: 37, folders: 2 })
    expect(totals.get("f2")).toEqual({ categories: 1, entries: 30, folders: 0 })
    expect(totals.get("f4")).toEqual({ categories: 0, entries: 0, folders: 0 })
  })

  it("monta a trilha até a pasta atual", () => {
    expect(breadcrumbOf(folders, "f2").map((f) => f.name)).toEqual(["Comida", "Fora"])
    expect(breadcrumbOf(folders, null)).toEqual([])
  })

  it("não deixa mover uma pasta para dentro de si mesma nem de uma descendente", () => {
    expect([...descendantFolderIds(folders, "f1")].sort()).toEqual(["f2", "f3"])
    const targets = moveTargets(folders, "f1").map((target) => target.id)
    expect(targets).toContain(null)
    expect(targets).toContain("f4")
    expect(targets).not.toContain("f1")
    expect(targets).not.toContain("f2")
    expect(targets).not.toContain("f3")
  })
})

// ---------------------------------------------------------------------------
// migração ao mover item de categoria
// ---------------------------------------------------------------------------

describe("migração de valores", () => {
  const origem: Estrutura = [
    { id: "o1", nome: "Comida", tipo: "star" },
    { id: "o2", nome: "Modo", tipo: "select", opcoes: ["Salão", "Delivery"] },
    { id: "o3", nome: "Pedido", tipo: "str" },
    { id: "o4", nome: "Visitas", tipo: "int" },
  ]
  const destino: Estrutura = [
    { id: "d1", nome: "comida", tipo: "star" },
    { id: "d2", nome: "Modo", tipo: "select", opcoes: ["Salão", "Balcão"] },
    { id: "d3", nome: "Visitas", tipo: "str" },
  ]

  it("preserva só nome+tipo iguais, e regrava sob o id do destino", () => {
    const result = migrateCustomFields(origem, destino, {
      o1: 4.5,
      o2: "Delivery",
      o3: "Omakase",
      o4: 3,
    })
    expect(result.values).toEqual({ d1: 4.5 })
    expect(result.kept).toBe(1)
    // Modo (opção não existe no destino), Pedido (não existe) e Visitas (tipo diferente)
    expect(result.dropped).toBe(3)
  })

  it("mantém a opção quando ela existe no destino", () => {
    const result = migrateCustomFields(origem, destino, { o2: "Salão" })
    expect(result.values).toEqual({ d2: "Salão" })
    expect(result.dropped).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// erros
// ---------------------------------------------------------------------------

describe("tradução de erro", () => {
  it("traduz os casos que aparecem de verdade", () => {
    expect(translateError("otp_expired")).toBe("Esse link/código expirou. Peça um novo.")
    expect(translateError({ message: "Signups not allowed for otp" })).toContain("convite")
    expect(translateError({ message: "Token has expired or is invalid" })).toBe(
      "Código inválido ou expirado. Peça um novo."
    )
    expect(translateError({ message: "email rate limit exceeded" })).toContain("Muitos e-mails")
    expect(
      translateError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "categories_owner_id_name_key"',
      })
    ).toBe("Você já tem uma categoria com esse nome.")
    expect(
      translateError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_username_key"',
      })
    ).toBe("Esse nome de usuário já está em uso.")
    expect(translateError({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Você só pode editar o que é seu."
    )
    expect(translateError({ message: "JWT expired" })).toBe("Sua sessão expirou. Faça login de novo.")
    expect(translateError({ message: "TypeError: fetch failed" })).toContain("variáveis de ambiente")
    expect(translateError({ message: "coisa estranha" })).toBe("Algo deu errado.")
    expect(translateError(null)).toBe("Algo deu errado.")
  })
})
