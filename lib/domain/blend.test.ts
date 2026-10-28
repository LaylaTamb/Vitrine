import { describe, expect, it } from "vitest"

import {
  blendDay,
  blendHighlights,
  blendPeopleLabel,
  blendSize,
  blendTaste,
  buildBlend,
  pairTaste,
  parseBlendPool,
  tasteWhy,
  type BlendItem,
  type BlendPool,
} from "./blend"

function item(
  owner: string,
  family: string,
  name: string,
  rating: number | null,
  extra: Partial<BlendItem> = {}
): BlendItem {
  return {
    entryId: `${owner}:${family}:${name}`,
    ownerId: owner,
    categoryId: `${owner}:${family}`,
    categoryName: family,
    categoryIcon: null,
    family,
    shared: true,
    key: `t:${family}|${name.toLowerCase()}`,
    name,
    rating,
    imageUrl: null,
    imageDisplay: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...extra,
  }
}

/** As famílias saem dos itens, mais as `extra` (categoria sem item na base). */
function poolOf(items: BlendItem[], extra: [string, string][] = []): BlendPool {
  const families = new Map<string, Set<string>>()
  for (const [owner, family] of [
    ...items.map((entry): [string, string] => [entry.ownerId, entry.family]),
    ...extra,
  ]) {
    families.set(owner, (families.get(owner) ?? new Set<string>()).add(family))
  }
  return { items, families }
}

describe("parseBlendPool", () => {
  it("nulo ou fora do formato: o match não é seu", () => {
    expect(parseBlendPool(null)).toBeNull()
    expect(parseBlendPool([])).toBeNull()
  })

  it("lê as famílias e os itens, e descarta a linha incompleta", () => {
    const pool = parseBlendPool({
      families: [
        { owner_id: "a", family: "filme" },
        { owner_id: "a", family: "jogo" },
        { owner_id: "b" },
      ],
      items: [
        {
          entry_id: "e1",
          owner_id: "a",
          category_id: "c1",
          category_name: "Filmes",
          family: "filme",
          shared: true,
          match_key: "t:filme|duna",
          name: "Duna",
          rating: "4.5",
          image_display: { x: 30 },
          updated_at: "2026-10-01T00:00:00Z",
        },
        { entry_id: "e2", owner_id: "a", rating: 0 },
      ],
    })
    expect(pool?.families.get("a")).toEqual(new Set(["filme", "jogo"]))
    expect(pool?.families.has("b")).toBe(false)
    expect(pool?.items).toHaveLength(1)
    expect(pool?.items[0]).toMatchObject({
      key: "t:filme|duna",
      rating: 4.5,
      shared: true,
      categoryIcon: null,
      imageDisplay: { x: 30 },
    })
  })
})

describe("pairTaste", () => {
  it("20% mundos + 40% itens + 40% notas", () => {
    const pool = poolOf([
      item("a", "filme", "A", 5),
      item("a", "filme", "B", 4),
      item("a", "filme", "C", 3),
      item("a", "filme", "D", 2),
      item("a", "filme", "E", 2),
      item("a", "filme", "F", 2),
      item("a", "filme", "G", 2),
      item("a", "filme", "H", 2),
      item("a", "jogo", "X", 5),
      item("a", "cerveja", "Z", 5),
      item("b", "filme", "A", 5),
      item("b", "filme", "B", 3),
      item("b", "filme", "C", 3),
      item("b", "filme", "P", 4),
      item("b", "filme", "Q", 4),
      item("b", "filme", "R", 4),
      item("b", "filme", "S", 4),
      item("b", "jogo", "X", 4),
      item("b", "jogo", "Y", 5),
    ])
    const taste = pairTaste(pool, "a", "b")
    // mundos: 2 ÷ √(3 × 2); itens: 4 ÷ √(9 × 9) ÷ 0,5 (a cerveja fica de fora:
    // só A tem); notas: (1 + 1 − 1/4,5 + 1 + 1 − 1/4,5) ÷ 4.
    const worlds = 2 / Math.sqrt(6)
    const items = 4 / 9 / 0.5
    const agreement = (4 - 2 / 4.5) / 4
    expect(taste).toMatchObject({ commonFamilies: 2, commonItems: 4, ratedBoth: 4 })
    expect(taste.percent).toBe(Math.round(100 * (0.2 * worlds + 0.4 * items + 0.4 * agreement)))
    expect(taste.agreement).toBe(Math.round(agreement * 100))
    expect(taste).toMatchObject({
      worlds: Math.round(worlds * 100),
      items: Math.round(Math.min(1, items) * 100),
    })
  })

  it("com menos de 3 itens avaliados pelos dois, as notas não contam", () => {
    const pool = poolOf([
      item("a", "filme", "A", null),
      item("a", "filme", "B", null),
      item("a", "filme", "C", null),
      item("a", "filme", "D", null),
      item("b", "filme", "A", 4),
      item("b", "filme", "E", 4),
      item("b", "filme", "F", 4),
      item("b", "filme", "G", 4),
    ])
    const taste = pairTaste(pool, "a", "b")
    expect(taste.agreement).toBeNull()
    // mundos 1; itens 1 ÷ √(4 × 4) ÷ 0,5 = 0,5 → 20% + 80% × 0,5.
    expect(taste.percent).toBe(60)
  })

  it("nenhuma categoria em comum: 0", () => {
    const pool = poolOf([item("a", "filme", "A", 5), item("b", "jogo", "A", 5)])
    expect(pairTaste(pool, "a", "b")).toMatchObject({ percent: 0, commonFamilies: 0 })
  })

  it("a categoria sem item na base também conta nos mundos", () => {
    const pool = poolOf([item("a", "filme", "A", 5), item("b", "filme", "A", 5)], [["a", "jogo"]])
    expect(pairTaste(pool, "a", "b").commonFamilies).toBe(1)
    expect(pairTaste(pool, "a", "b").percent).toBe(Math.round(100 * (0.2 / Math.sqrt(2) + 0.8)))
  })
})

describe("blendTaste", () => {
  it("o grupo é a média dos pares, e destaca o par mais parecido", () => {
    const pool = poolOf([
      item("a", "filme", "A", 5),
      item("b", "filme", "A", 5),
      item("c", "filme", "B", 5),
    ])
    const taste = blendTaste(pool, ["a", "b", "c"])
    expect(taste.pairs).toHaveLength(3)
    expect(taste.best).toMatchObject({ a: "a", b: "b" })
    const mean = taste.pairs.reduce((sum, pair) => sum + pair.percent, 0) / 3
    expect(taste.percent).toBe(Math.round(mean))
  })

  it("sem pares: sem %", () => {
    expect(blendTaste(poolOf([]), ["a"])).toEqual({ percent: null, pairs: [], best: null })
  })
})

describe("blendHighlights", () => {
  it("a categoria com mais coisas em comum e o item com a maior nota de todos", () => {
    const pool = poolOf([
      item("a", "filme", "Duna", 5, { categoryName: "Filmes" }),
      item("a", "filme", "Alien", 4, { categoryName: "Filmes" }),
      item("b", "filme", "Duna", 4.5, { categoryName: "Filmes favoritos" }),
      item("b", "filme", "Alien", 5, { categoryName: "Filmes favoritos" }),
      item("a", "jogo", "Hades", 5, { imageUrl: "https://x/h.jpg" }),
      item("b", "jogo", "Hades", 5),
    ])
    const highlights = blendHighlights(pool)
    expect(highlights.family).toEqual({ name: "Filmes", icon: null, common: 2 })
    expect(highlights.item?.item).toMatchObject({ name: "Hades", imageUrl: "https://x/h.jpg" })
    expect(highlights.item?.owners).toEqual([
      { userId: "a", rating: 5 },
      { userId: "b", rating: 5 },
    ])
  })

  it("no empate de nota, o item da categoria que mais une", () => {
    const pool = poolOf([
      item("a", "cerveja", "Amstel", 5),
      item("b", "cerveja", "Amstel", 5),
      item("a", "filme", "Duna", 5),
      item("b", "filme", "Duna", 5),
      item("a", "filme", "Alien", 3),
      item("b", "filme", "Alien", 4),
    ])
    expect(blendHighlights(pool).item?.item.name).toBe("Duna")
  })

  it("sem nada em comum: nada", () => {
    expect(blendHighlights(poolOf([item("a", "filme", "A", 5)]))).toEqual({
      family: null,
      item: null,
    })
  })
})

describe("blendSize e blendDay", () => {
  it("30 em dupla, +5 por pessoa, até 50", () => {
    expect([2, 3, 4, 6, 8].map(blendSize)).toEqual([30, 35, 40, 50, 50])
  })

  it("o dia é o de São Paulo", () => {
    expect(blendDay(new Date("2026-10-29T02:30:00Z"))).toBe("2026-10-28")
    expect(blendDay(new Date("2026-10-29T03:30:00Z"))).toBe("2026-10-29")
  })
})

describe("buildBlend", () => {
  const NOW = new Date("2026-10-28T15:00:00Z")
  const SHARED = ["filme", "jogo", "manga", "cerveja"]

  /** 4 famílias em comum (8 coisas iguais e 8 de cada um em cada) + 5 descobertas de cada. */
  function bigPool(): BlendPool {
    const items: BlendItem[] = []
    SHARED.forEach((family, f) => {
      for (let i = 0; i < 8; i++) {
        items.push(item("a", family, `comum ${i}`, 4 + ((i + f) % 3) * 0.5))
        items.push(item("b", family, `comum ${i}`, 3.5 + ((i * 2 + f) % 4) * 0.5))
        items.push(item("a", family, `só a ${i}`, 4 + (i % 3) * 0.5))
        items.push(item("b", family, `só b ${i}`, 4 + ((i + 1) % 3) * 0.5))
      }
    })
    for (let i = 0; i < 5; i++) {
      items.push(item("a", "podcast", `pod ${i}`, 5, { shared: false }))
      items.push(item("b", "serie", `serie ${i}`, 4.5, { shared: false }))
    }
    // Os dois deram nota baixa: não entra.
    items.push(item("a", "cerveja", "ruim", 2), item("b", "cerveja", "ruim", 1.5))
    return poolOf(items)
  }

  const run = (seed = "m1:2026-10-28", pool = bigPool(), members = ["a", "b"]) =>
    buildBlend({ pool, memberIds: members, seed, now: NOW })

  it("30 itens, sem repetir, nas fatias certas", () => {
    const picks = run()
    expect(picks).toHaveLength(30)
    expect(new Set(picks.map((pick) => pick.key)).size).toBe(30)
    const count = (kind: string) => picks.filter((pick) => pick.kind === kind).length
    expect([count("common"), count("suggestion"), count("discovery")]).toEqual([12, 15, 3])
  })

  it("cada pessoa coloca a mesma quantidade (no máximo 1 de diferença)", () => {
    const picks = run().filter((pick) => pick.kind !== "common")
    const fromA = picks.filter((pick) => pick.owners[0].userId === "a").length
    const fromB = picks.filter((pick) => pick.owners[0].userId === "b").length
    expect(Math.abs(fromA - fromB)).toBeLessThanOrEqual(1)
  })

  it("descoberta só de categoria que só uma pessoa tem", () => {
    for (const pick of run().filter((option) => option.kind === "discovery")) {
      expect(["podcast", "serie"]).toContain(pick.item.family)
    }
  })

  it("em comum com nota baixa de todo mundo fica de fora", () => {
    expect(run().some((pick) => pick.item.name === "ruim")).toBe(false)
  })

  it("nenhuma família passa de 1/3 da lista, e nunca duas seguidas da mesma", () => {
    const picks = run()
    const perFamily = new Map<string, number>()
    for (const pick of picks) {
      perFamily.set(pick.item.family, (perFamily.get(pick.item.family) ?? 0) + 1)
    }
    expect(Math.max(...perFamily.values())).toBeLessThanOrEqual(10)
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i].item.family).not.toBe(picks[i - 1].item.family)
    }
  })

  it("o mesmo dia dá a mesma lista; outro dia, outra", () => {
    const keys = (seed: string) => run(seed).map((pick) => pick.key)
    expect(keys("m1:2026-10-28")).toEqual(keys("m1:2026-10-28"))
    expect(keys("m1:2026-10-29")).not.toEqual(keys("m1:2026-10-28"))
  })

  it("quem tem e a nota de cada um, na ordem do match", () => {
    const common = run().find((pick) => pick.kind === "common")
    expect(common?.owners.map((owner) => owner.userId)).toEqual(["a", "b"])
    expect(common?.owners.every((owner) => owner.entryId.startsWith(owner.userId))).toBe(true)
  })

  it("base pequena: o que der, sem quebrar", () => {
    const pool = poolOf([
      item("a", "filme", "A", 5),
      item("b", "filme", "A", 4),
      item("a", "filme", "B", 4.5),
      item("b", "filme", "C", 3),
    ])
    const picks = run("x", pool)
    expect(picks.map((pick) => [pick.item.name, pick.kind])).toEqual([
      ["A", "common"],
      ["B", "suggestion"],
    ])
    expect(run("x", poolOf([]))).toEqual([])
  })

  it("um grupo de 3 tem 35 itens e as três pessoas colocam sugestões", () => {
    const pool = bigPool()
    for (const family of SHARED) {
      for (let i = 0; i < 8; i++) pool.items.push(item("c", family, `só c ${i}`, 4.5))
    }
    const picks = run("m2:2026-10-28", pool, ["a", "b", "c"])
    expect(picks).toHaveLength(35)
    const owners = new Set(
      picks.filter((pick) => pick.kind === "suggestion").map((pick) => pick.owners[0].userId)
    )
    expect(owners).toEqual(new Set(["a", "b", "c"]))
  })
})

describe("textos", () => {
  const base = {
    a: "a",
    b: "b",
    percent: 76,
    commonFamilies: 10,
    commonItems: 54,
    ratedBoth: 49,
    agreement: 83,
    worlds: 66,
    items: 75,
  }

  it("quem está no match, para o story", () => {
    expect(blendPeopleLabel(["ana", "bia"])).toBe("@ana e @bia")
    expect(blendPeopleLabel(["a", "b", "c", "d"])).toBe("@a, @b, @c e @d")
    expect(blendPeopleLabel(["a", "b", "c", "d", "e", "f"])).toBe("@a, @b, @c e mais 3")
  })

  it("o porquê da %", () => {
    expect(tasteWhy(base)).toBe(
      "Vocês têm 10 categorias em comum e 54 itens iguais, e as notas batem em 83%."
    )
    expect(tasteWhy({ ...base, commonFamilies: 1, commonItems: 0, agreement: null })).toBe(
      "Vocês têm 1 categoria em comum e nenhum item igual, mas ainda poucas notas para comparar."
    )
    expect(tasteWhy({ ...base, commonFamilies: 0 })).toBe(
      "Vocês ainda não têm nenhuma categoria em comum."
    )
  })
})
