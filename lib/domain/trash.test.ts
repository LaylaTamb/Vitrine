import { describe, expect, it } from "vitest"

import {
  daysLeft,
  parseRestoreResult,
  parseTrashItems,
  purgeLabel,
  restoredHref,
  restoredMessage,
} from "./trash"

const NOW = new Date("2026-10-21T12:00:00Z")

describe("lixeira", () => {
  it("lê as linhas e descarta o que vier torto", () => {
    const items = parseTrashItems([
      {
        id: "t1",
        kind: "category",
        name: "Filmes",
        icon: "🎬",
        location: "Coleções › Cinema",
        item_count: 12,
        deleted_at: "2026-10-20T12:00:00Z",
        purge_after: "2026-11-19T12:00:00Z",
      },
      { id: "t2", kind: "item", deleted_at: "x", purge_after: "y" },
      { id: "t3", kind: "folder", name: " ", item_count: -3, deleted_at: "a", purge_after: "b" },
    ])
    expect(items.map((item) => item.id)).toEqual(["t1", "t3"])
    expect(items[1]).toMatchObject({ name: "Sem nome", itemCount: 0, icon: null })
  })

  it("quantos dias faltam", () => {
    expect(daysLeft("2026-11-20T12:00:00Z", NOW)).toBe(30)
    expect(daysLeft("2026-10-21T18:00:00Z", NOW)).toBe(1)
    expect(daysLeft("2026-10-20T12:00:00Z", NOW)).toBe(0)
    expect(purgeLabel("2026-11-20T12:00:00Z", NOW)).toBe("some em 30 dias")
    expect(purgeLabel("2026-10-21T18:00:00Z", NOW)).toBe("some amanhã")
    expect(purgeLabel("2026-10-20T12:00:00Z", NOW)).toBe("some hoje")
  })

  it("depois de restaurar: a frase e para onde ir", () => {
    const category = parseRestoreResult({ kind: "category", id: "c1", name: "Filmes", renamed: false })
    expect(restoredMessage(category)).toBe("“Filmes” voltou para as Coleções.")
    expect(restoredHref(category)).toBe("/categoria/c1")

    const renamed = parseRestoreResult({
      kind: "category",
      id: "c2",
      name: "Filmes (restaurada)",
      renamed: true,
    })
    expect(restoredMessage(renamed)).toBe(
      "Voltou como “Filmes (restaurada)” (já havia uma com o mesmo nome)."
    )

    const sub = parseRestoreResult({ kind: "entry_folder", id: "f1", name: "Marcas", category_id: "c1" })
    expect(restoredHref(sub)).toBe("/categoria/c1?pasta=f1")
    expect(restoredHref(parseRestoreResult({ kind: "folder", id: "p1", name: "Bebidas" }))).toBe(
      "/?pasta=p1"
    )
  })
})
