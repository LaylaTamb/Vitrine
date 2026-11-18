"use server"

import { revalidatePath } from "next/cache"

import type { EntryPickerRow } from "@/lib/actions/contracts"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  applyTagSchema,
  createTagSchema,
  idSchema,
  searchEntriesForTagSchema,
  updateTagSchema,
} from "@/lib/actions/schemas"
import { isMissingColumn } from "@/lib/domain/errors"
import { normalizeTagColor } from "@/lib/domain/tags"
import type { Tag } from "@/lib/domain/types"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Cada tag é de uma categoria de uma pessoa (migração 49): só o dono cria,
 * edita e apaga (a RLS confere). Antes do 49, a tag ainda é do grupo todo.
 */
export async function createTagAction(input: {
  name: string
  color: string
  categoryId?: string
}): Promise<ActionResult<Tag>> {
  const parsed = createTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const tag = { name: parsed.data.name, color: normalizeTagColor(parsed.data.color) }
  const insert = (row: Record<string, unknown>) =>
    supabase.from("tags").insert(row).select("id, name, color").single()

  let { data, error } = await insert(
    parsed.data.categoryId
      ? { ...tag, owner_id: user.id, category_id: parsed.data.categoryId }
      : tag
  )
  if (error && isMissingColumn(error, "category_id")) ({ data, error } = await insert(tag))
  if (error) {
    // Depois do 49, a tag precisa de categoria.
    return !parsed.data.categoryId && String((error as { code?: unknown }).code) === "23502"
      ? { ok: false, error: "Crie a tag dentro de uma categoria: ela vale só para os itens de lá." }
      : fail(error)
  }

  // A categoria da tag (e o filtro geral) mostram a nova.
  revalidatePath("/", "layout")
  return ok(data as Tag)
}

export async function updateTagAction(input: {
  id: string
  name: string
  color: string
}): Promise<ActionResult> {
  const parsed = updateTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, color: normalizeTagColor(parsed.data.color) })
    .eq("id", parsed.data.id)

  if (error) return fail(error)

  revalidatePath("/tags")
  revalidatePath("/", "layout")
  return ok()
}

export async function deleteTagAction(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  // O `on delete cascade` de entry_tags tira a tag dos itens; os itens ficam.
  const { error } = await supabase.from("tags").delete().eq("id", parsed.data.id)

  if (error) return fail(error)

  revalidatePath("/tags")
  revalidatePath("/", "layout")
  return ok()
}

// ---------------------------------------------------------------------------
// Aplicar uma tag a itens, cruzando todas as categorias do dono
// ---------------------------------------------------------------------------

interface EntryPickerJoinRow {
  id: string
  name: string
  entry_tags: { tag_id: string }[] | null
  category: { id: string; name: string; icon: string | null } | null
}

/**
 * Itens do dono logado para o diálogo "Aplicar a itens": só os da categoria
 * da tag (migração 49; antes dele, de qualquer categoria). Só os seus
 * próprios: `entry_tags` só aceita insert/delete de quem é dono do item (RLS).
 */
export async function searchEntriesForTagAction(input: {
  tagId: string
  query: string
}): Promise<ActionResult<EntryPickerRow[]>> {
  const parsed = searchEntriesForTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  // Antes do 49 a coluna não existe: a busca cruza todas as categorias.
  const tagRow = await supabase
    .from("tags")
    .select("category_id")
    .eq("id", parsed.data.tagId)
    .maybeSingle()
  const tagCategory = tagRow.error
    ? null
    : ((tagRow.data as { category_id?: string } | null)?.category_id ?? null)

  let query = supabase
    .from("entries")
    .select("id, name, entry_tags(tag_id), category:categories(id, name, icon)")
    .eq("owner_id", user.id)
    .order("name", { ascending: true })
    .limit(100)

  const search = parsed.data.query.trim()
  if (search) query = query.ilike("name", `%${search}%`)
  if (tagCategory) query = query.eq("category_id", tagCategory)

  const { data, error } = await query
  if (error) return fail(error)

  const rows = ((data ?? []) as unknown as EntryPickerJoinRow[])
    .filter((row) => row.category !== null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      categoryId: row.category!.id,
      categoryName: row.category!.name,
      categoryIcon: row.category!.icon,
      hasTag: (row.entry_tags ?? []).some((link) => link.tag_id === parsed.data.tagId),
    }))

  return ok(rows)
}

export async function applyTagToEntriesAction(input: {
  tagId: string
  ids: string[]
}): Promise<ActionResult> {
  const parsed = applyTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase
    .from("entry_tags")
    .upsert(
      parsed.data.ids.map((entryId) => ({ entry_id: entryId, tag_id: parsed.data.tagId })),
      { onConflict: "entry_id,tag_id", ignoreDuplicates: true }
    )

  if (error) return fail(error)

  // Os itens marcados podem ser de qualquer categoria: revalida tudo de uma vez.
  revalidatePath("/", "layout")
  return ok()
}
