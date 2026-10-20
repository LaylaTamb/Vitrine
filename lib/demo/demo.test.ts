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

  it("traz uma lista sem estrelas, em ordem manual", () => {
    const state = buildDemoState(getSeedPayload())
    const lista = state.categories.find((category) => category.name === "Quero visitar")!
    expect(lista).toMatchObject({ rating_enabled: false, default_sort: "manual" })
    const itens = state.entries.filter((entry) => entry.category_id === lista.id)
    expect(itens.every((entry) => entry.rating === null)).toBe(true)
    expect(itens.map((entry) => entry.display_order)).toEqual([0, 1, 2, 3, 4, 5])
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
      ratingEnabled: true,
      defaultSort: "recent",
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
        ratingEnabled: true,
        defaultSort: "recent",
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

describe("estrelas opcionais e ordem manual na demonstração", () => {
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
    () => demoId(`novo2:${++counter}`),
    () => "2026-10-01T10:00:00.000Z"
  )

  beforeEach(() => {
    state = buildDemoState(getSeedPayload())
    counter = 0
  })

  const byName = (name: string) => state.categories.find((category) => category.name === name)!
  const levelOf = (categoryId: string, folderId: string | null) =>
    state.entries
      .filter((entry) => entry.category_id === categoryId && entry.folder_id === folderId)
      .sort((a, b) => a.display_order - b.display_order)

  it("desligar as estrelas apaga as notas, e o impacto conta quantas", async () => {
    const filmes = byName("Filmes")
    const impacto = await actions.structureImpact({ categoryId: filmes.id, fieldIds: [] })
    expect(impacto.ok && impacto.data?.rated).toBe(10)

    await actions.updateCategory({
      id: filmes.id,
      name: filmes.name,
      icon: filmes.icon,
      color: filmes.color,
      estrutura: filmes.estrutura,
      ratingEnabled: false,
      defaultSort: "rating_desc",
    })

    expect(byName("Filmes").rating_enabled).toBe(false)
    expect(state.entries.filter((e) => e.category_id === filmes.id && e.rating !== null)).toEqual([])
  })

  it("lista sem estrelas ignora a nota que chegar", async () => {
    const lista = byName("Quero visitar")
    await actions.createEntry({
      categoryId: lista.id,
      name: "Museu do Ipiranga",
      rating: 4,
      imageUrl: null,
      imageDisplay: { x: 50, y: 50, zoom: 1 },
      customFields: {},
      tagIds: [],
    })
    const criado = state.entries.find((entry) => entry.name === "Museu do Ipiranga")!
    expect(criado.rating).toBeNull()
    // Item novo entra no fim da ordem manual.
    expect(criado.display_order).toBe(6)
  })

  it("arrastar grava a ordem nova sem mexer no updated_at", async () => {
    const lista = byName("Quero visitar")
    const antes = levelOf(lista.id, null)
    const invertido = [...antes].reverse().map((entry) => entry.id)

    await actions.reorderEntries({ categoryId: lista.id, ids: invertido })

    const depois = levelOf(lista.id, null)
    expect(depois.map((entry) => entry.id)).toEqual(invertido)
    expect(depois.map((entry) => entry.updated_at)).toEqual(
      [...antes].reverse().map((entry) => entry.updated_at)
    )
  })

  it("arrastar subpastas grava a ordem nova", async () => {
    const vinhos = byName("Vinhos")
    const pastas = state.entryFolders.filter((folder) => folder.category_id === vinhos.id)
    const nova = [...pastas].sort((a, b) => b.display_order - a.display_order).map((f) => f.id)

    await actions.reorderEntryFolders({ categoryId: vinhos.id, ids: nova })

    const ordenadas = state.entryFolders
      .filter((folder) => folder.category_id === vinhos.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((folder) => folder.id)
    expect(ordenadas).toEqual(nova)
  })

  it("pasta nova e itens movidos entram no fim do nível", async () => {
    const vinhos = byName("Vinhos")
    const criada = await actions.createEntryFolder({
      categoryId: vinhos.id,
      name: "Feitos em casa",
      parentFolderId: null,
    })
    const pasta = state.entryFolders.find((folder) => folder.id === (criada.ok ? criada.data!.id : ""))!
    expect(pasta.display_order).toBe(2)

    const nacionais = state.entryFolders.find((folder) => folder.name === "Nacionais")!
    const importados = state.entryFolders.find((folder) => folder.name === "Importados")!
    const doisNacionais = levelOf(vinhos.id, nacionais.id).slice(0, 2).map((entry) => entry.id)
    await actions.moveEntriesToFolder({
      ids: doisNacionais,
      categoryId: vinhos.id,
      folderId: importados.id,
    })
    expect(levelOf(vinhos.id, importados.id).slice(-2).map((entry) => entry.id)).toEqual(
      doisNacionais
    )
  })
})

// ---------------------------------------------------------------------------
// "A organizar"
// ---------------------------------------------------------------------------

describe("A organizar na demonstração", () => {
  let state: DemoState
  const store = {
    get: () => state,
    set: (next: DemoState) => {
      state = next
    },
  }
  const actions = createDemoActions(
    store,
    () => demoId(`novo:${Math.random()}`),
    () => "2026-09-28T10:00:00.000Z"
  )
  const inbox = () => state.categories.find((category) => category.kind === "inbox")!

  beforeEach(() => {
    state = buildDemoState(getSeedPayload())
  })

  it("existe exatamente uma, privada, na raiz, com itens de exemplo", () => {
    expect(state.categories.filter((category) => category.kind === "inbox")).toHaveLength(1)
    expect(inbox()).toMatchObject({ name: "A organizar", folder_id: null, visibility: "private" })
    expect(state.entries.some((entry) => entry.category_id === inbox().id)).toBe(true)
  })

  it("não pode ser apagada, editada nem movida", async () => {
    const id = inbox().id
    expect((await actions.deleteCategory({ id })).ok).toBe(false)
    expect(
      (
        await actions.updateCategory({
          id,
          name: "Outra",
          icon: null,
          color: null,
          estrutura: [],
          ratingEnabled: false,
          defaultSort: "recent",
        })
      ).ok
    ).toBe(false)
    const folder = state.folders[0]
    expect((await actions.moveCategory({ id, targetFolderId: folder.id })).ok).toBe(false)
    expect(inbox()).toMatchObject({ id, name: "A organizar", folder_id: null })
  })

  it("os itens dela vão para qualquer outra categoria", async () => {
    const padaria = state.entries.find((entry) => entry.name === "Padaria que a Ana indicou")!
    const restaurantes = state.categories.find((category) => category.name === "Restaurantes")!
    const result = await actions.bulkMoveEntries({
      ids: [padaria.id],
      categoryId: inbox().id,
      toCategoryId: restaurantes.id,
    })
    expect(result.ok).toBe(true)
    expect(state.entries.find((entry) => entry.id === padaria.id)?.category_id).toBe(
      restaurantes.id
    )
  })
})

// ---------------------------------------------------------------------------
// campo principal (acesso rápido)
// ---------------------------------------------------------------------------

describe("campo principal na demonstração", () => {
  let state: DemoState
  const store = {
    get: () => state,
    set: (next: DemoState) => {
      state = next
    },
  }
  const actions = createDemoActions(
    store,
    () => demoId(`novo:${Math.random()}`),
    () => "2026-09-28T10:00:00.000Z"
  )

  beforeEach(() => {
    state = buildDemoState(getSeedPayload())
  })

  it("toda categoria do exemplo começa com o Nome", () => {
    expect(state.categories.every((category) => category.quick_field === "name")).toBe(true)
  })

  it("guarda o escolhido e volta para o Nome quando o campo some", async () => {
    const livros = state.categories.find((category) => category.name === "Livros")!
    const campo = livros.estrutura[0]
    const base = {
      id: livros.id,
      name: livros.name,
      icon: livros.icon,
      color: livros.color,
      ratingEnabled: livros.rating_enabled,
      defaultSort: "recent" as const,
    }

    await actions.updateCategory({ ...base, estrutura: livros.estrutura, quickField: campo.id })
    expect(state.categories.find((category) => category.id === livros.id)?.quick_field).toBe(
      campo.id
    )

    const semCampo = livros.estrutura.filter((field) => field.id !== campo.id)
    await actions.updateCategory({
      ...base,
      estrutura: semCampo,
      quickField: campo.id,
      removedFieldIds: [campo.id],
    })
    expect(state.categories.find((category) => category.id === livros.id)?.quick_field).toBe(
      "name"
    )
  })

  it("Estrelas só valem com as estrelas ligadas", async () => {
    const created = await actions.createCategory({
      name: "Podcasts",
      icon: null,
      color: null,
      folderId: null,
      estrutura: [],
      ratingEnabled: false,
      defaultSort: "recent",
      quickField: "rating",
    })
    const id = created.ok ? created.data!.id : ""
    expect(state.categories.find((category) => category.id === id)?.quick_field).toBe("name")
  })
})

// ---------------------------------------------------------------------------
// favoritos
// ---------------------------------------------------------------------------

describe("favoritos na demonstração", () => {
  let state: DemoState
  const store = {
    get: () => state,
    set: (next: DemoState) => {
      state = next
    },
  }
  const actions = createDemoActions(
    store,
    () => demoId(`novo:${Math.random()}`),
    () => "2026-09-28T10:00:00.000Z"
  )
  const byName = (name: string) => state.categories.find((category) => category.name === name)!
  const entry = (name: string) => state.entries.find((item) => item.name === name)!
  const favoriteOf = (categoryId: string) =>
    state.favorites.find((row) => row.category_id === categoryId)?.entry_id ?? null

  beforeEach(() => {
    state = buildDemoState(getSeedPayload())
  })

  it("o exemplo já tem favoritos e uma aba com uma categoria sem favorito", () => {
    expect(favoriteOf(byName("Restaurantes").id)).toBe(entry("Kinoshita").id)
    const tab = state.favorites
      .filter((row) => row.tab_position !== null)
      .sort((a, b) => a.tab_position! - b.tab_position!)
    expect(tab.map((row) => state.categories.find((c) => c.id === row.category_id)?.name)).toEqual([
      "Restaurantes",
      "Filmes",
      "Livros",
      "Vinhos",
    ])
    expect(favoriteOf(byName("Vinhos").id)).toBeNull()
  })

  it("marca, troca e desmarca o favorito", async () => {
    const restaurantes = byName("Restaurantes").id
    await actions.setFavoriteEntry({ categoryId: restaurantes, entryId: entry("Mocotó").id })
    expect(favoriteOf(restaurantes)).toBe(entry("Mocotó").id)
    await actions.setFavoriteEntry({ categoryId: restaurantes, entryId: null })
    expect(favoriteOf(restaurantes)).toBeNull()
  })

  it("recusa item de outra categoria", async () => {
    const result = await actions.setFavoriteEntry({
      categoryId: byName("Restaurantes").id,
      entryId: entry("Dom Casmurro").id,
    })
    expect(result.ok).toBe(false)
  })

  it("item apagado ou movido deixa de ser o favorito", async () => {
    const restaurantes = byName("Restaurantes").id
    await actions.bulkMoveEntries({
      ids: [entry("Kinoshita").id],
      categoryId: restaurantes,
      toCategoryId: byName("Quero visitar").id,
    })
    expect(favoriteOf(restaurantes)).toBeNull()

    const filmes = byName("Filmes").id
    await actions.deleteEntry({ id: entry("Cidade de Deus").id, categoryId: filmes })
    expect(favoriteOf(filmes)).toBeNull()
  })

  it("a aba guarda a ordem, e tirar da aba mantém o favorito", async () => {
    const livros = byName("Livros").id
    const filmes = byName("Filmes").id
    await actions.setFavoritesTab({ categoryIds: [livros, filmes] })
    const tab = state.favorites
      .filter((row) => row.tab_position !== null)
      .sort((a, b) => a.tab_position! - b.tab_position!)
      .map((row) => row.category_id)
    expect(tab).toEqual([livros, filmes])
    expect(favoriteOf(byName("Restaurantes").id)).toBe(entry("Kinoshita").id)
  })
})
