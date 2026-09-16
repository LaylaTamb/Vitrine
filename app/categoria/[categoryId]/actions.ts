"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { coerceCustomFields, parseEstrutura } from "@/lib/domain/fields"
import { migrateCustomFields } from "@/lib/domain/migrate"
import type { CustomFields, Estrutura } from "@/lib/domain/types"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

const uuid = z.uuid("Identificador inválido.")

const entrySchema = z.object({
  categoryId: uuid,
  name: z.string().trim().min(1, "Dê um nome ao item.").max(160, "Nome muito longo."),
  rating: z
    .number()
    .min(0, "A nota vai de 0 a 5.")
    .max(5, "A nota vai de 0 a 5.")
    .nullable(),
  imageUrl: z.string().trim().max(2048).nullable(),
  imageDisplay: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(3),
  }),
  customFields: z.record(z.string(), z.union([z.string(), z.number()])),
  tagIds: z.array(uuid),
})

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

/** Meia estrela: a nota só existe em passos de 0,5. */
function normalizeRating(rating: number | null): number | null {
  if (rating === null) return null
  const value = Math.min(5, Math.max(0, Math.round(rating * 2) / 2))
  return value === 0 ? null : value
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
  input: z.input<typeof entrySchema>
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
  input: z.input<typeof entrySchema> & { id: string }
): Promise<ActionResult> {
  const parsed = entrySchema.extend({ id: uuid }).safeParse(input)
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
  const parsed = z.object({ id: uuid, categoryId: uuid }).safeParse(input)
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

const bulkSchema = z.object({
  ids: z.array(uuid).min(1, "Selecione pelo menos um item."),
  categoryId: uuid,
})

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
  const parsed = bulkSchema
    .extend({ tagId: uuid, mode: z.enum(["add", "remove"]) })
    .safeParse(input)
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

export interface MovePreview {
  /** Quantos valores de campo serão descartados na migração. */
  dropped: number
  kept: number
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
  const parsed = bulkSchema.extend({ toCategoryId: uuid }).safeParse(input)
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
  const parsed = bulkSchema.extend({ toCategoryId: uuid }).safeParse(input)
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
  // tipo — e é regravado sob o id do campo do destino.
  const results = await Promise.all(
    context.entries.map((entry) => {
      const migrated = migrateCustomFields(context.from, context.to, entry.custom_fields ?? {})
      return supabase
        .from("entries")
        .update({ category_id: parsed.data.toCategoryId, custom_fields: migrated.values })
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
