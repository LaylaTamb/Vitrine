"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { FIELD_TYPES } from "@/lib/domain/types"
import { parseEstrutura } from "@/lib/domain/fields"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

const uuid = z.uuid("Identificador inválido.")
const fieldId = z.string().regex(/^f_[a-z0-9]{6}$/, "Identificador de campo inválido.")

const estruturaSchema = z.array(
  z.object({
    id: fieldId,
    nome: z.string().trim().min(1, "Dê um nome ao campo."),
    tipo: z.enum(FIELD_TYPES),
    opcoes: z.array(z.string()).optional(),
  })
)

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à pasta.").max(80, "Nome muito longo."),
  parentFolderId: uuid.nullable(),
})

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

export async function createFolderAction(input: {
  name: string
  parentFolderId: string | null
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
    })
    .select("id")
    .single()

  if (error) return fail(error)
  revalidatePath("/")
  return ok({ id: (data as { id: string }).id })
}

export async function renameFolderAction(input: {
  id: string
  name: string
}): Promise<ActionResult> {
  const parsed = z
    .object({ id: uuid, name: z.string().trim().min(1, "Dê um nome à pasta.").max(80) })
    .safeParse(input)
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
  const parsed = z.object({ id: uuid, targetFolderId: uuid.nullable() }).safeParse(input)
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

  const { error } = await supabase
    .from("folders")
    .update({ parent_folder_id: parsed.data.targetFolderId })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

export async function deleteFolderAction(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  // O `on delete cascade` do banco leva subpastas, categorias e itens junto.
  const { error } = await supabase.from("folders").delete().eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria.").max(80, "Nome muito longo."),
  icon: z.string().trim().max(4, "O ícone é um emoji só.").nullable(),
  estrutura: estruturaSchema,
})

export async function createCategoryAction(input: {
  name: string
  icon: string | null
  folderId: string | null
  estrutura: unknown
}): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema
    .extend({ folderId: uuid.nullable() })
    .safeParse({ ...input, estrutura: parseEstrutura(input.estrutura) })
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

  const { data, error } = await supabase
    .from("categories")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      icon: parsed.data.icon || null,
      folder_id: parsed.data.folderId,
      estrutura: parsed.data.estrutura,
      display_order,
    })
    .select("id")
    .single()

  if (error) return fail(error)
  revalidatePath("/")
  return ok({ id: (data as { id: string }).id })
}

export async function updateCategoryAction(input: {
  id: string
  name: string
  icon: string | null
  estrutura: unknown
  /** Ids de campo removidos cujos valores devem sair dos itens. */
  removedFieldIds?: string[]
}): Promise<ActionResult> {
  const parsed = categorySchema
    .extend({ id: uuid, removedFieldIds: z.array(fieldId).optional() })
    .safeParse({ ...input, estrutura: parseEstrutura(input.estrutura) })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      icon: parsed.data.icon || null,
      estrutura: parsed.data.estrutura,
    })
    .eq("id", parsed.data.id)

  if (error) return fail(error)

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

  revalidatePath("/")
  revalidatePath(`/categoria/${parsed.data.id}`)
  return ok()
}

export async function moveCategoryAction(input: {
  id: string
  targetFolderId: string | null
}): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, targetFolderId: uuid.nullable() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase
    .from("categories")
    .update({ folder_id: parsed.data.targetFolderId })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

export async function deleteCategoryAction(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath("/")
  return ok()
}

// ---------------------------------------------------------------------------
// Reordenar um nível inteiro
// ---------------------------------------------------------------------------

const reorderSchema = z.object({
  items: z.array(z.object({ kind: z.enum(["folder", "category"]), id: uuid })),
})

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

export interface StructureImpact {
  total: number
  /** id do campo → quantos itens têm valor gravado nele */
  filled: Record<string, number>
}

/**
 * Quantos itens existem na categoria e quantos têm valor em cada campo que
 * está sendo removido — é o que o diálogo de confirmação mostra.
 */
export async function structureImpactAction(input: {
  categoryId: string
  fieldIds: string[]
}): Promise<ActionResult<StructureImpact>> {
  const parsed = z
    .object({ categoryId: uuid, fieldIds: z.array(fieldId) })
    .safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()

  const [totalResult, ...fieldResults] = await Promise.all([
    supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("category_id", parsed.data.categoryId),
    ...parsed.data.fieldIds.map((id) =>
      supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("category_id", parsed.data.categoryId)
        .not(`custom_fields->>${id}`, "is", null)
    ),
  ])

  if (totalResult.error) return fail(totalResult.error)

  const filled: Record<string, number> = {}
  parsed.data.fieldIds.forEach((id, index) => {
    filled[id] = fieldResults[index]?.count ?? 0
  })

  return ok({ total: totalResult.count ?? 0, filled })
}
