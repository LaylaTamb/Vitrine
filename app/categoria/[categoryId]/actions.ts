"use server"

import { revalidatePath } from "next/cache"

import type { EntryInput, MovePreview } from "@/lib/actions/contracts"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  bulkMoveSchema,
  bulkSchema,
  bulkTagSchema,
  createEntryFolderSchema,
  deleteEntryFolderSchema,
  deleteEntrySchema,
  entrySchema,
  moveEntriesToFolderSchema,
  moveFolderSchema,
  normalizeRating,
  renameFolderSchema,
  updateEntrySchema,
} from "@/lib/actions/schemas"
import { descendantFolderIds } from "@/lib/domain/collections"
import { coerceCustomFields, parseEstrutura } from "@/lib/domain/fields"
import { migrateCustomFields } from "@/lib/domain/migrate"
import type { CustomFields, EntryFolder, Estrutura } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

async function estruturaOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string
): Promise<Estrutura> {
  const { data } = await supabase
    .from("categories")
    .select("estrutura")
    .eq("id", categoryId)
    .maybeSingle()
  return parseEstrutura((data as { estrutura: unknown } | null)?.estrutura)
}

async function writeTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  tagIds: string[]
): Promise<{ error: unknown } | null> {
  const { error: clearError } = await supabase.from("entry_tags").delete().eq("entry_id", entryId)
  if (clearError) return { error: clearError }

  if (tagIds.length === 0) return null

  const { error } = await supabase
    .from("entry_tags")
    .insert(tagIds.map((tagId) => ({ entry_id: entryId, tag_id: tagId })))
  return error ? { error } : null
}

export async function createEntryAction(
  input: EntryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const estrutura = await estruturaOf(supabase, parsed.data.categoryId)

  const { data, error } = await supabase
    .from("entries")
    .insert({
      category_id: parsed.data.categoryId,
      folder_id: parsed.data.folderId ?? null,
      owner_id: user.id,
      name: parsed.data.name,
      rating: normalizeRating(parsed.data.rating),
      image_url: parsed.data.imageUrl || null,
      image_display: parsed.data.imageDisplay,
      custom_fields: coerceCustomFields(estrutura, parsed.data.customFields),
    })
    .select("id")
    .single()

  if (error) return fail(error)

  const entryId = (data as { id: string }).id
  const tagError = await writeTags(supabase, entryId, parsed.data.tagIds)
  if (tagError) return fail(tagError.error)

  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  revalidatePath("/")
  return ok({ id: entryId })
}

export async function updateEntryAction(
  input: EntryInput & { id: string }
): Promise<ActionResult> {
  const parsed = updateEntrySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const estrutura = await estruturaOf(supabase, parsed.data.categoryId)

  const { error } = await supabase
    .from("entries")
    .update({
      name: parsed.data.name,
      rating: normalizeRating(parsed.data.rating),
      image_url: parsed.data.imageUrl || null,
      image_display: parsed.data.imageDisplay,
      custom_fields: coerceCustomFields(estrutura, parsed.data.customFields),
      // `folderId` ausente = o formulário não mexeu na pasta.
      ...(parsed.data.folderId !== undefined ? { folder_id: parsed.data.folderId } : {}),
    })
    .eq("id", parsed.data.id)

  if (error) return fail(error)

  const tagError = await writeTags(supabase, parsed.data.id, parsed.data.tagIds)
  if (tagError) return fail(tagError.error)

  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  revalidatePath(`/categoria/${parsed.data.categoryId}/${parsed.data.id}`)
  return ok()
}

export async function deleteEntryAction(input: {
  id: string
  categoryId: string
}): Promise<ActionResult> {
  const parsed = deleteEntrySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.from("entries").delete().eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  revalidatePath("/")
  return ok()
}

// ---------------------------------------------------------------------------
// Ações em massa
// ---------------------------------------------------------------------------

export async function bulkDeleteEntriesAction(input: {
  ids: string[]
  categoryId: string
}): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.from("entries").delete().in("id", parsed.data.ids)

  if (error) return fail(error)
  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  revalidatePath("/")
  return ok()
}

export async function bulkTagAction(input: {
  ids: string[]
  categoryId: string
  tagId: string
  mode: "add" | "remove"
}): Promise<ActionResult> {
  const parsed = bulkTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()

  const { error } =
    parsed.data.mode === "add"
      ? await supabase
          .from("entry_tags")
          .upsert(
            parsed.data.ids.map((entryId) => ({ entry_id: entryId, tag_id: parsed.data.tagId })),
            { onConflict: "entry_id,tag_id", ignoreDuplicates: true }
          )
      : await supabase
          .from("entry_tags")
          .delete()
          .eq("tag_id", parsed.data.tagId)
          .in("entry_id", parsed.data.ids)

  if (error) return fail(error)
  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  return ok()
}

async function loadMoveContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
  fromCategoryId: string,
  toCategoryId: string
) {
  const [fromResult, toResult, entriesResult] = await Promise.all([
    supabase.from("categories").select("estrutura").eq("id", fromCategoryId).maybeSingle(),
    supabase.from("categories").select("estrutura").eq("id", toCategoryId).maybeSingle(),
    supabase.from("entries").select("id, custom_fields").in("id", ids),
  ])

  return {
    from: parseEstrutura((fromResult.data as { estrutura: unknown } | null)?.estrutura),
    to: parseEstrutura((toResult.data as { estrutura: unknown } | null)?.estrutura),
    entries: (entriesResult.data ?? []) as { id: string; custom_fields: CustomFields }[],
    error: fromResult.error ?? toResult.error ?? entriesResult.error,
  }
}

/** Quantos valores se perdem ao mover — mostrado antes de confirmar. */
export async function movePreviewAction(input: {
  ids: string[]
  categoryId: string
  toCategoryId: string
}): Promise<ActionResult<MovePreview>> {
  const parsed = bulkMoveSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const context = await loadMoveContext(
    supabase,
    parsed.data.ids,
    parsed.data.categoryId,
    parsed.data.toCategoryId
  )
  if (context.error) return fail(context.error)

  let dropped = 0
  let kept = 0
  for (const entry of context.entries) {
    const result = migrateCustomFields(context.from, context.to, entry.custom_fields ?? {})
    dropped += result.dropped
    kept += result.kept
  }

  return ok({ dropped, kept })
}

export async function bulkMoveEntriesAction(input: {
  ids: string[]
  categoryId: string
  toCategoryId: string
}): Promise<ActionResult> {
  const parsed = bulkMoveSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const context = await loadMoveContext(
    supabase,
    parsed.data.ids,
    parsed.data.categoryId,
    parsed.data.toCategoryId
  )
  if (context.error) return fail(context.error)

  // Um valor sobrevive quando o destino tem um campo de mesmo nome e mesmo
  // tipo — e é regravado sob o id do campo do destino. As subpastas são da
  // categoria de origem, então o item chega na raiz do destino (a FK
  // composta do banco recusaria manter o `folder_id`).
  const results = await Promise.all(
    context.entries.map((entry) => {
      const migrated = migrateCustomFields(context.from, context.to, entry.custom_fields ?? {})
      return supabase
        .from("entries")
        .update({
          category_id: parsed.data.toCategoryId,
          folder_id: null,
          custom_fields: migrated.values,
        })
        .eq("id", entry.id)
    })
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) return fail(failed.error)

  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  revalidatePath(`/categoria/${parsed.data.toCategoryId}`)
  revalidatePath("/")
  return ok()
}

// ---------------------------------------------------------------------------
// Subpastas dentro da categoria
// ---------------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>

async function loadEntryFolder(supabase: Supabase, id: string): Promise<EntryFolder | null> {
  const { data } = await supabase.from("entry_folders").select("*").eq("id", id).maybeSingle()
  return (data as EntryFolder | null) ?? null
}

async function loadCategoryFolders(supabase: Supabase, categoryId: string): Promise<EntryFolder[]> {
  const { data } = await supabase.from("entry_folders").select("*").eq("category_id", categoryId)
  return (data ?? []) as EntryFolder[]
}

export async function createEntryFolderAction(input: {
  categoryId: string
  name: string
  parentFolderId: string | null
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createEntryFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  // A RLS confere que a categoria é de quem cria; a FK composta, que a
  // pasta-mãe é da mesma categoria.
  const { data, error } = await supabase
    .from("entry_folders")
    .insert({
      owner_id: user.id,
      category_id: parsed.data.categoryId,
      parent_folder_id: parsed.data.parentFolderId,
      name: parsed.data.name,
    })
    .select("id")
    .single()

  if (error) return fail(error)
  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  return ok({ id: (data as { id: string }).id })
}

export async function renameEntryFolderAction(input: {
  id: string
  name: string
}): Promise<ActionResult> {
  const parsed = renameFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("entry_folders")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("category_id")
    .maybeSingle()

  if (error) return fail(error)
  const categoryId = (data as { category_id: string } | null)?.category_id
  if (categoryId) revalidatePath(`/categoria/${categoryId}`)
  return ok()
}

export async function moveEntryFolderAction(input: {
  id: string
  targetFolderId: string | null
}): Promise<ActionResult> {
  const parsed = moveFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  if (parsed.data.targetFolderId === parsed.data.id) {
    return { ok: false, error: "Uma pasta não pode ir para dentro dela mesma." }
  }

  const supabase = await createClient()
  const folder = await loadEntryFolder(supabase, parsed.data.id)
  if (!folder) return { ok: false, error: "Essa pasta não existe mais." }

  // Mesmo cuidado das Coleções: dentro de uma descendente vira ciclo órfão.
  if (parsed.data.targetFolderId) {
    const folders = await loadCategoryFolders(supabase, folder.category_id)
    if (descendantFolderIds(folders, folder.id).has(parsed.data.targetFolderId)) {
      return { ok: false, error: "Uma pasta não pode ir para dentro de uma subpasta dela." }
    }
  }

  const { error } = await supabase
    .from("entry_folders")
    .update({ parent_folder_id: parsed.data.targetFolderId })
    .eq("id", parsed.data.id)

  if (error) return fail(error)
  revalidatePath(`/categoria/${folder.category_id}`)
  return ok()
}

/**
 * Exclui uma subpasta. Com `keepContents`, as subpastas e os itens dela sobem
 * um nível antes (para a pasta-mãe, ou para a raiz da categoria); sem, o
 * `on delete cascade` do banco leva tudo junto.
 */
export async function deleteEntryFolderAction(input: {
  id: string
  keepContents: boolean
}): Promise<ActionResult> {
  const parsed = deleteEntryFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const folder = await loadEntryFolder(supabase, parsed.data.id)
  if (!folder) return { ok: false, error: "Essa pasta não existe mais." }

  if (parsed.data.keepContents) {
    const [foldersMove, entriesMove] = await Promise.all([
      supabase
        .from("entry_folders")
        .update({ parent_folder_id: folder.parent_folder_id })
        .eq("parent_folder_id", folder.id),
      supabase
        .from("entries")
        .update({ folder_id: folder.parent_folder_id })
        .eq("folder_id", folder.id),
    ])
    if (foldersMove.error) return fail(foldersMove.error)
    if (entriesMove.error) return fail(entriesMove.error)
  }

  const { error } = await supabase.from("entry_folders").delete().eq("id", folder.id)

  if (error) return fail(error)
  revalidatePath(`/categoria/${folder.category_id}`)
  revalidatePath("/")
  return ok()
}

export async function moveEntriesToFolderAction(input: {
  ids: string[]
  categoryId: string
  folderId: string | null
}): Promise<ActionResult> {
  const parsed = moveEntriesToFolderSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase
    .from("entries")
    .update({ folder_id: parsed.data.folderId })
    .in("id", parsed.data.ids)
    .eq("category_id", parsed.data.categoryId)

  if (error) return fail(error)
  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  return ok()
}
