"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { CategoryInput, StructureImpact } from "@/lib/actions/contracts"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  createCategorySchema,
  createFolderSchema,
  idSchema,
  moveFolderSchema,
  renameFolderSchema,
  reorderSchema,
  searchItemsSchema,
  structureImpactSchema,
  updateCategorySchema,
  visibilitySchema,
} from "@/lib/actions/schemas"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import { locationFieldsOf, parseEstrutura } from "@/lib/domain/fields"
import { VISIBILITY_NOT_READY, type Visibility } from "@/lib/domain/privacy"
import {
  parseItemHits,
  SEARCH_MIN,
  SEARCH_NOT_READY,
  normalizeSearch,
  type ItemHit,
} from "@/lib/domain/search"
import { normalizeQuickField, QUICK_FIELD_NAME } from "@/lib/domain/quick-field"
import { normalizeCategoryColor } from "@/lib/domain/tags"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

// ---------------------------------------------------------------------------
// Busca nas Coleções
// ---------------------------------------------------------------------------

/**
 * Os seus itens cujo nome, tag ou valor de campo tem o texto (migração 35).
 * Pastas e categorias a tela procura sozinha (ela já tem as duas listas).
 */
export async function searchMyItemsAction(input: {
  query: string
}): Promise<ActionResult<ItemHit[]>> {
  const parsed = searchItemsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  if (normalizeSearch(parsed.data.query).length < SEARCH_MIN) return ok([])

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_my_items", {
    p_query: parsed.data.query,
    p_limit: 40,
  })
  if (error) return isMissingSchema(error) ? { ok: false, error: SEARCH_NOT_READY } : fail(error)
  return ok(parseItemHits(data))
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

/**
 * Sair: o Supabase revoga as sessões da conta em TODOS os aparelhos
 * (`global`) e o cookie daqui é apagado. O token de acesso que já saiu ainda
 * vale até expirar (1 h, no padrão do Supabase) — limite do próprio JWT.
 */
export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "global" })
  revalidatePath("/", "layout")
  redirect("/login")
}

// ---------------------------------------------------------------------------
// Privacidade — Pública (qualquer pessoa, mesmo sem conta), Amigos ou Privada
// (só o dono). Quem esconde de fato é a RLS do banco (migração 14); estas
// ações só gravam a escolha.
// ---------------------------------------------------------------------------

/** Como `fail`, mas explica o que fazer quando a coluna da migração 14 ainda não existe. */
function failPrivacy(error: unknown): ActionResult<never> {
  return isMissingColumn(error) ? { ok: false, error: VISIBILITY_NOT_READY } : fail(error)
}

async function setVisibility(
  table: "folders" | "categories",
  input: { id: string; visibility: Visibility }
): Promise<ActionResult> {
  const parsed = visibilitySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(table)
    .update({ visibility: parsed.data.visibility })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .select("id")

  if (error) return failPrivacy(error)
  if (!data || data.length === 0) {
    return { ok: false, error: "Só quem criou pode mudar a privacidade." }
  }

  // As telas de todo mundo leem de novo — a de outra pessoa (/v/...) inclusive.
  revalidatePath("/", "layout")
  return ok()
}

export async function setFolderVisibilityAction(input: {
  id: string
  visibility: Visibility
}): Promise<ActionResult> {
  return setVisibility("folders", input)
}

export async function setCategoryVisibilityAction(input: {
  id: string
  visibility: Visibility
}): Promise<ActionResult> {
  return setVisibility("categories", input)
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

async function nextOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "folders" | "categories",
  ownerId: string,
  parentColumn: "parent_folder_id" | "folder_id",
  parentId: string | null
): Promise<number> {
  let query = supabase
    .from(table)
    .select("display_order")
    .eq("owner_id", ownerId)
    .order("display_order", { ascending: false })
    .limit(1)

  query = parentId === null ? query.is(parentColumn, null) : query.eq(parentColumn, parentId)

  const { data } = await query
  const top = (data ?? [])[0] as { display_order: number } | undefined
  return (top?.display_order ?? -1) + 1
}

/**
 * A posição no fim de um nível das Coleções. Pastas e categorias dividem a
 * mesma sequência de `display_order` (`reorderLevelAction`): conta as duas.
 */
async function nextLevelOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  folderId: string | null
): Promise<number> {
  const [folders, categories] = await Promise.all([
    nextOrder(supabase, "folders", ownerId, "parent_folder_id", folderId),
    nextOrder(supabase, "categories", ownerId, "folder_id", folderId),
  ])
  return Math.max(folders, categories)
}

export async function createFolderAction(input: {
  name: string
  parentFolderId: string | null
  visibility?: Visibility
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const display_order = await nextOrder(
    supabase,
    "folders",
    user.id,
    "parent_folder_id",
    parsed.data.parentFolderId
  )

  const { data, error } = await supabase
    .from("folders")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      parent_folder_id: parsed.data.parentFolderId,
      display_order,
      // Sem escolha explícita, o banco põe o padrão do perfil (migração 14).
      ...(parsed.data.visibility === undefined ? {} : { visibility: parsed.data.visibility }),
    })
    .select("id")
    .single()

  if (error) return failPrivacy(error)
  revalidatePath("/")
  return ok({ id: (data as { id: string }).id })
}

export async function renameFolderAction(input: {
  id: string
  name: string
}): Promise<ActionResult> {
  const parsed = renameFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase
    .from("folders")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

export async function moveFolderAction(input: {
  id: string
  targetFolderId: string | null
}): Promise<ActionResult> {
  const parsed = moveFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  if (parsed.data.targetFolderId === parsed.data.id) {
    return { ok: false, error: "Uma pasta não pode ir para dentro dela mesma." }
  }

  const user = await requireUser()
  const supabase = await createClient()

  // Uma pasta não pode ir para dentro de uma descendente: o banco aceitaria e
  // a árvore viraria um ciclo órfão, sumindo da tela.
  if (parsed.data.targetFolderId) {
    const { data } = await supabase
      .from("folders")
      .select("id, parent_folder_id")
      .eq("owner_id", user.id)

    const byId = new Map(
      ((data ?? []) as { id: string; parent_folder_id: string | null }[]).map((row) => [
        row.id,
        row.parent_folder_id,
      ])
    )
    let cursor: string | null | undefined = parsed.data.targetFolderId
    const guard = new Set<string>()
    while (cursor && !guard.has(cursor)) {
      if (cursor === parsed.data.id) {
        return { ok: false, error: "Uma pasta não pode ir para dentro de uma subpasta dela." }
      }
      guard.add(cursor)
      cursor = byId.get(cursor) ?? null
    }
  }

  // Chega no fim do nível de destino.
  const display_order = await nextLevelOrder(supabase, user.id, parsed.data.targetFolderId)
  const { error } = await supabase
    .from("folders")
    .update({ parent_folder_id: parsed.data.targetFolderId, display_order })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

/**
 * Apagar uma pasta: vai para a Lixeira (migração 37), com as subpastas, as
 * categorias e os itens — dá para restaurar por 30 dias. Antes da migração,
 * apaga direto (o `on delete cascade` leva tudo junto).
 */
export async function deleteFolderAction(input: {
  id: string
}): Promise<ActionResult<{ trashId: string | null }>> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const trashed = await supabase.rpc("trash_folder", { p_folder_id: parsed.data.id })
  if (trashed.error && !isMissingSchema(trashed.error)) return fail(trashed.error)
  if (trashed.error) {
    const { error } = await supabase.from("folders").delete().eq("id", parsed.data.id)
    if (error) return fail(error)
  }

  revalidatePath("/")
  revalidatePath("/lixeira")
  return ok({ trashId: typeof trashed.data === "string" ? trashed.data : null })
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

const QUICK_FIELD_NOT_READY =
  "O campo do acesso rápido ainda não está no banco: rode supabase/19_quick_field.sql no SQL Editor do Supabase."

export async function createCategoryAction(
  input: CategoryInput & {
    folderId: string | null
    visibility?: Visibility
    sourceCategoryId?: string
  }
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse({
    ...input,
    estrutura: parseEstrutura(input.estrutura),
  })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const display_order = await nextOrder(
    supabase,
    "categories",
    user.id,
    "folder_id",
    parsed.data.folderId
  )

  const row = {
    owner_id: user.id,
    name: parsed.data.name,
    icon: parsed.data.icon || null,
    color: normalizeCategoryColor(parsed.data.color),
    folder_id: parsed.data.folderId,
    estrutura: parsed.data.estrutura,
    rating_enabled: parsed.data.ratingEnabled,
    default_sort: parsed.data.defaultSort,
    display_order,
    ...(parsed.data.visibility === undefined ? {} : { visibility: parsed.data.visibility }),
  }
  const quick = normalizeQuickField(
    parsed.data.quickField,
    parsed.data.estrutura,
    parsed.data.ratingEnabled
  )

  const insert = (values: Record<string, unknown>) =>
    supabase.from("categories").insert(values).select("id").single()

  // Veio de um modelo (migração 25): a categoria lembra de onde, e o banco
  // conta mais um "usado por" na original.
  const source = parsed.data.sourceCategoryId
  let { data, error } = await insert({
    ...row,
    quick_field: quick,
    ...(source ? { source_category_id: source } : {}),
  })
  // Antes da migração 25, ou o modelo foi apagado nesse meio-tempo: nasce
  // igual, só sem lembrar de onde veio.
  if (
    error &&
    source &&
    (isMissingColumn(error, "source_category_id") ||
      String((error as { code?: unknown }).code) === "23503")
  ) {
    ;({ data, error } = await insert({ ...row, quick_field: quick }))
  }
  // Antes da migração 19: com o Nome (o padrão) não há o que perder.
  if (error && isMissingColumn(error, "quick_field")) {
    if (quick !== QUICK_FIELD_NAME) return { ok: false, error: QUICK_FIELD_NOT_READY }
    ;({ data, error } = await supabase.from("categories").insert(row).select("id").single())
  }

  if (error) return failPrivacy(error)
  revalidatePath("/")
  return ok({ id: (data as { id: string }).id })
}

export async function updateCategoryAction(
  input: CategoryInput & {
    id: string
    /** Ids de campo removidos cujos valores devem sair dos itens. */
    removedFieldIds?: string[]
  }
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse({
    ...input,
    estrutura: parseEstrutura(input.estrutura),
  })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()

  const changes = {
    name: parsed.data.name,
    icon: parsed.data.icon || null,
    color: normalizeCategoryColor(parsed.data.color),
    estrutura: parsed.data.estrutura,
    rating_enabled: parsed.data.ratingEnabled,
    default_sort: parsed.data.defaultSort,
  }
  // Campo removido ou estrelas desligadas: o campo principal volta para o Nome.
  const quick = normalizeQuickField(
    parsed.data.quickField,
    parsed.data.estrutura,
    parsed.data.ratingEnabled
  )

  let { error } = await supabase
    .from("categories")
    .update({ ...changes, quick_field: quick })
    .eq("id", parsed.data.id)
  // Antes da migração 19: com o Nome (o padrão) não há o que perder.
  if (error && isMissingColumn(error, "quick_field")) {
    if (quick !== QUICK_FIELD_NAME) return { ok: false, error: QUICK_FIELD_NOT_READY }
    ;({ error } = await supabase.from("categories").update(changes).eq("id", parsed.data.id))
  }

  if (error) return fail(error)

  // Estrelas desligadas: as notas saem de fato dos itens (a pessoa confirmou
  // no diálogo de impacto quantas se perdem).
  if (!parsed.data.ratingEnabled) {
    const { error: ratingError } = await supabase
      .from("entries")
      .update({ rating: null })
      .eq("category_id", parsed.data.id)
      .not("rating", "is", null)
    if (ratingError) return fail(ratingError)
  }

  // Campo removido: o valor sai de fato de todos os itens da categoria.
  const removed = parsed.data.removedFieldIds ?? []
  if (removed.length > 0) {
    const { data: rows, error: readError } = await supabase
      .from("entries")
      .select("id, custom_fields")
      .eq("category_id", parsed.data.id)

    if (readError) return fail(readError)

    const dirty = ((rows ?? []) as { id: string; custom_fields: Record<string, unknown> }[])
      .map((row) => {
        const custom = { ...(row.custom_fields ?? {}) }
        let changed = false
        for (const id of removed) {
          if (id in custom) {
            delete custom[id]
            changed = true
          }
        }
        return changed ? { id: row.id, custom_fields: custom } : null
      })
      .filter((row): row is { id: string; custom_fields: Record<string, unknown> } => row !== null)

    if (dirty.length > 0) {
      const results = await Promise.all(
        dirty.map((row) =>
          supabase.from("entries").update({ custom_fields: row.custom_fields }).eq("id", row.id)
        )
      )
      const failed = results.find((result) => result.error)
      if (failed?.error) return fail(failed.error)
    }
  }

  // Localização: os pinos só valem para os campos de Localização que
  // continuam existindo — campo removido, ou trocado para outro tipo
  // (inclusive pelo modo JSON), perde as linhas de `entry_places`. Banco sem
  // a migração 11 ainda não tem o que limpar.
  const { error: pruneError } = await supabase.rpc("prune_entry_places", {
    p_category_id: parsed.data.id,
    p_field_ids: locationFieldsOf(parsed.data.estrutura).map((field) => field.id),
  })
  if (pruneError && !isMissingSchema(pruneError)) return fail(pruneError)

  revalidatePath("/")
  revalidatePath(`/categoria/${parsed.data.id}`)
  revalidatePath("/mapa")
  return ok()
}

export async function moveCategoryAction(input: {
  id: string
  targetFolderId: string | null
}): Promise<ActionResult> {
  const parsed = moveFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  // Chega no fim do nível de destino.
  const display_order = await nextLevelOrder(supabase, user.id, parsed.data.targetFolderId)
  const { error } = await supabase
    .from("categories")
    .update({ folder_id: parsed.data.targetFolderId, display_order })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

/**
 * Apagar uma categoria: vai para a Lixeira (migração 37), com os itens —
 * dá para restaurar por 30 dias. Antes da migração, apaga direto.
 */
export async function deleteCategoryAction(input: {
  id: string
}): Promise<ActionResult<{ trashId: string | null }>> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const trashed = await supabase.rpc("trash_category", { p_category_id: parsed.data.id })
  if (trashed.error && !isMissingSchema(trashed.error)) return fail(trashed.error)
  if (trashed.error) {
    const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id)
    if (error) return fail(error)
  }

  revalidatePath("/")
  revalidatePath("/lixeira")
  return ok({ trashId: typeof trashed.data === "string" ? trashed.data : null })
}

// ---------------------------------------------------------------------------
// Reordenar um nível inteiro
// ---------------------------------------------------------------------------

/**
 * Grava a ordem do nível inteiro em um upsert por tabela — não um UPDATE por
 * item. Pastas e categorias compartilham a mesma sequência de `display_order`.
 */
export async function reorderLevelAction(input: {
  items: { kind: "folder" | "category"; id: string }[]
}): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const folderIds = parsed.data.items.filter((i) => i.kind === "folder").map((i) => i.id)
  const categoryIds = parsed.data.items.filter((i) => i.kind === "category").map((i) => i.id)

  // Relê as linhas para montar o upsert com dados do banco, não do cliente.
  const [foldersResult, categoriesResult] = await Promise.all([
    folderIds.length > 0
      ? supabase
          .from("folders")
          .select("id, owner_id, name, parent_folder_id")
          .in("id", folderIds)
          .eq("owner_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length > 0
      ? supabase
          .from("categories")
          .select("id, owner_id, name, folder_id")
          .in("id", categoryIds)
          .eq("owner_id", user.id)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (foldersResult.error) return fail(foldersResult.error)
  if (categoriesResult.error) return fail(categoriesResult.error)

  const folderRows = new Map(
    ((foldersResult.data ?? []) as {
      id: string
      owner_id: string
      name: string
      parent_folder_id: string | null
    }[]).map((row) => [row.id, row])
  )
  const categoryRows = new Map(
    ((categoriesResult.data ?? []) as {
      id: string
      owner_id: string
      name: string
      folder_id: string | null
    }[]).map((row) => [row.id, row])
  )

  // Pastas e categorias dividem a mesma sequência: o índice é a posição no
  // nível inteiro, não dentro do próprio tipo.
  const folderPayload: Record<string, unknown>[] = []
  const categoryPayload: Record<string, unknown>[] = []

  parsed.data.items.forEach((item, index) => {
    if (item.kind === "folder") {
      const row = folderRows.get(item.id)
      if (row) folderPayload.push({ ...row, display_order: index })
    } else {
      const row = categoryRows.get(item.id)
      if (row) categoryPayload.push({ ...row, display_order: index })
    }
  })

  const [folderWrite, categoryWrite] = await Promise.all([
    folderPayload.length > 0
      ? supabase.from("folders").upsert(folderPayload, { onConflict: "id" })
      : Promise.resolve({ error: null }),
    categoryPayload.length > 0
      ? supabase.from("categories").upsert(categoryPayload, { onConflict: "id" })
      : Promise.resolve({ error: null }),
  ])

  if (folderWrite.error) return fail(folderWrite.error)
  if (categoryWrite.error) return fail(categoryWrite.error)

  revalidatePath("/")
  return ok()
}

// ---------------------------------------------------------------------------
// Impacto de uma edição de estrutura
// ---------------------------------------------------------------------------

/**
 * Quantos itens existem na categoria, quantos têm valor em cada campo que
 * está sendo removido, e quantos usam cada opção que está saindo de um
 * `select` que continua existindo — é o que o diálogo de confirmação mostra.
 */
export async function structureImpactAction(input: {
  categoryId: string
  fieldIds: string[]
  /** Campos `select` que continuam existindo, com as opções que saíram da lista. */
  fieldOptions?: { fieldId: string; options: string[] }[]
}): Promise<ActionResult<StructureImpact>> {
  const parsed = structureImpactSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()

  const optionChecks = (parsed.data.fieldOptions ?? []).flatMap((entry) =>
    entry.options.map((option) => ({ fieldId: entry.fieldId, option }))
  )

  const [totalResult, ratedResult, fieldResults, optionResults] = await Promise.all([
    supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("category_id", parsed.data.categoryId),
    supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("category_id", parsed.data.categoryId)
      .not("rating", "is", null),
    Promise.all(
      parsed.data.fieldIds.map((id) =>
        supabase
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("category_id", parsed.data.categoryId)
          .not(`custom_fields->>${id}`, "is", null)
      )
    ),
    Promise.all(
      optionChecks.map(({ fieldId: id, option }) =>
        supabase
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("category_id", parsed.data.categoryId)
          .eq(`custom_fields->>${id}`, option)
      )
    ),
  ])

  if (totalResult.error) return fail(totalResult.error)

  const filled: Record<string, number> = {}
  parsed.data.fieldIds.forEach((id, index) => {
    filled[id] = fieldResults[index]?.count ?? 0
  })

  const optionUsage: Record<string, Record<string, number>> = {}
  optionChecks.forEach(({ fieldId: id, option }, index) => {
    optionUsage[id] ??= {}
    optionUsage[id][option] = optionResults[index]?.count ?? 0
  })

  return ok({
    total: totalResult.count ?? 0,
    rated: ratedResult.count ?? 0,
    filled,
    optionUsage,
  })
}
