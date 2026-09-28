import { beforeEach, describe, expect, it } from "vitest"

import { getSeedPayload } from "./seed"
import { buildDemoState, demoCounts, demoId, type DemoState } from "./state"
import { createDemoActions } from "./store"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// ---------------------------------------------------------------------------
// estado inicial
// ---------------------------------------------------------------------------

describe("acervo de exemplo", () => {
  it("gera ids determinísticos, em formato UUID v4", () => {
    expect(demoId("categoria:vinhos")).toBe(demoId("categoria:vinhos"))
    expect(demoId("categoria:vinhos")).not.toBe(demoId("categoria:filmes"))
    expect(demoId("categoria:vinhos")).toMatch(UUID)
  })

  it("monta o mesmo estado toda vez — o F5 acha a mesma categoria", () => {
    const a = buildDemoState(getSeedPayload())
    const b = buildDemoState(getSeedPayload())
    expect(a).toEqual(b)
  })

  it("tem as próprias tags, não as do grupo", () => {
    const state = buildDemoState(getSeedPayload())
    expect(state.tags.map((tag) => tag.name)).toContain("Favorito")
    expect(state.entries.some((entry) => entry.entry_tags.length > 0)).toBe(true)
  })

  it("traz subpastas de exemplo, com itens dentro", () => {
    const state = buildDemoState(getSeedPayload())
    const orwell = state.entryFolders.find((folder) => folder.name === "George Orwell")
    const classicos = state.entryFolders.find((folder) => folder.name === "Clássicos")
    expect(orwell?.parent_folder_id).toBe(classicos?.id)
    expect(state.entries.filter((entry) => entry.folder_id === orwell?.id)).toHaveLength(2)
    // Pasta e item são sempre da mesma categoria.
    for (const entry of state.entries) {
      if (!entry.folder_id) continue
      const folder = state.entryFolders.find((item) => item.id === entry.folder_id)
      expect(folder?.category_id).toBe(entry.category_id)
    }
  })
})

// ---------------------------------------------------------------------------
// operações em memória
// ---------------------------------------------------------------------------

describe("escritas da demonstração", () => {
  let state: DemoState
  let counter = 0
  const store = {
    get: () => state,
    set: (next: DemoState) => {
      state = next
    },
  }
  const actions = createDemoActions(
    store,
    () => demoId(`novo:${++counter}`),
    () => "2026-09-28T10:00:00.000Z"
  )

  beforeEach(() => {
    state = buildDemoState(getSeedPayload())
    counter = 0
  })

  const vinhos = () => state.categories.find((category) => category.name === "Vinhos")!
  const livros = () => state.categories.find((category) => category.name === "Livros")!

  it("nunca muta o estado anterior", async () => {
    const before = state
    const snapshot = JSON.stringify(before)
    await actions.createFolder({ name: "Nova", parentFolderId: null })
    await actions.deleteCategory({ id: vinhos().id })
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(state).not.toBe(before)
  })

  it("cria pasta, categoria e tag só na memória", async () => {
    const folder = await actions.createFolder({ name: "Bebidas", parentFolderId: null })
    expect(folder.ok).toBe(true)
    const folderId = folder.ok ? folder.data!.id : ""

    const category = await actions.createCategory({
      name: "Suco",
      icon: "🧃",
      color: null,
      folderId,
      estrutura: [{ id: "f_marca1", nome: "Marca", tipo: "str" }],
    })
    expect(category.ok).toBe(true)
    expect(state.categories.find((item) => item.name === "Suco")?.folder_id).toBe(folderId)

    const tag = await actions.createTag({ name: "Gelado", color: "#8FB3C9" })
    expect(tag.ok && tag.data?.name).toBe("Gelado")
  })

  it("valida com os mesmos schemas e mensagens do app", async () => {
    expect(await actions.createFolder({ name: "  ", parentFolderId: null })).toEqual({
      ok: false,
      error: "Dê um nome à pasta.",
    })
    expect(
      await actions.createCategory({
        name: "Vinhos",
        icon: null,
        color: null,
        folderId: null,
        estrutura: [],
      })
    ).toEqual({ ok: false, error: "Você já tem uma categoria com esse nome." })
    expect(await actions.createTag({ name: "favorito", color: "#B98CC2" })).toEqual({
      ok: false,
      error: "Já existe uma tag com esse nome.",
    })
  })

  it("cria subpasta e item dentro dela", async () => {
    const folder = await actions.createEntryFolder({
      categoryId: vinhos().id,
      name: "Feitos em casa",
      parentFolderId: null,
    })
    const folderId = folder.ok ? folder.data!.id : ""
    const entry = await actions.createEntry({
      categoryId: vinhos().id,
      folderId,
      name: "Vinho da vó",
      rating: 4.3,
      imageUrl: null,
      imageDisplay: { x: 50, y: 50, zoom: 1 },
      customFields: { safra: "2024" },
      tagIds: [],
    })
    expect(entry.ok).toBe(true)
    const created = state.entries.find((item) => item.name === "Vinho da vó")!
    expect(created.folder_id).toBe(folderId)
    expect(created.rating).toBe(4.5) // meia estrela, como no app
  })

  it("recusa pasta de outra categoria", async () => {
    const importados = state.entryFolders.find((folder) => folder.name === "Importados")!
    const result = await actions.moveEntriesToFolder({
      ids: [state.entries.find((entry) => entry.category_id === livros().id)!.id],
      categoryId: livros().id,
      folderId: importados.id,
    })
    expect(result.ok).toBe(false)
  })

  it("excluir subpasta mantendo o conteúdo sobe tudo um nível", async () => {
    const classicos = state.entryFolders.find((folder) => folder.name === "Clássicos")!
    const orwell = state.entryFolders.find((folder) => folder.name === "George Orwell")!
    const total = state.entries.length

    await actions.deleteEntryFolder({ id: classicos.id, keepContents: true })

    expect(state.entryFolders.some((folder) => folder.id === classicos.id)).toBe(false)
    expect(state.entryFolders.find((folder) => folder.id === orwell.id)?.parent_folder_id).toBeNull()
    expect(state.entries).toHaveLength(total)
    expect(state.entries.filter((entry) => entry.folder_id === classicos.id)).toHaveLength(0)
  })

  it("excluir subpasta com tudo leva as subpastas e os itens junto", async () => {
    const classicos = state.entryFolders.find((folder) => folder.name === "Clássicos")!
    const total = state.entries.length

    await actions.deleteEntryFolder({ id: classicos.id, keepContents: false })

    expect(state.entryFolders.some((folder) => folder.name === "George Orwell")).toBe(false)
    expect(state.entries).toHaveLength(total - 4)
  })

  it("mover item para outra categoria migra campos e cai na raiz", async () => {
    const miolo = state.entries.find((entry) => entry.name === "Miolo Reserva")!
    expect(miolo.folder_id).not.toBeNull()

    await actions.bulkMoveEntries({
      ids: [miolo.id],
      categoryId: vinhos().id,
      toCategoryId: livros().id,
    })

    const moved = state.entries.find((entry) => entry.id === miolo.id)!
    expect(moved.category_id).toBe(livros().id)
    expect(moved.folder_id).toBeNull()
    expect(Object.keys(moved.custom_fields)).toEqual([]) // Livros não tem campo de Vinhos
  })

  it("excluir pasta das Coleções leva categorias, subpastas e itens", async () => {
    const consumo = state.folders.find((folder) => folder.name === "Consumo")!
    const before = demoCounts(state)
    const doomed = state.categories.filter((category) => category.folder_id === consumo.id)
    const lost = doomed.reduce((sum, category) => sum + (before[category.id] ?? 0), 0)
    const total = state.entries.length

    await actions.deleteFolder({ id: consumo.id })

    expect(state.categories.some((category) => category.folder_id === consumo.id)).toBe(false)
    expect(state.entryFolders.some((folder) => doomed.some((c) => c.id === folder.category_id))).toBe(
      false
    )
    expect(state.entries).toHaveLength(total - lost)
  })

  it("apagar tag só tira a tag dos itens", async () => {
    const favorito = state.tags.find((tag) => tag.name === "Favorito")!
    const total = state.entries.length

    await actions.deleteTag({ id: favorito.id })

    expect(state.entries).toHaveLength(total)
    expect(
      state.entries.some((entry) => entry.entry_tags.some((link) => link.tag_id === favorito.id))
    ).toBe(false)
  })
})
