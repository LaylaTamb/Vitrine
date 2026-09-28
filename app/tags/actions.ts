"use server"

import { revalidatePath } from "next/cache"

import type { EntryPickerRow } from "@/lib/actions/contracts"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  applyTagSchema,
  idSchema,
  searchEntriesForTagSchema,
  tagSchema,
  updateTagSchema,
} from "@/lib/actions/schemas"
import { normalizeTagColor } from "@/lib/domain/tags"
import type { Tag } from "@/lib/domain/types"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * As tags são do grupo inteiro: qualquer autenticado cria, edita e apaga, e a
 * mudança reflete no acervo de todo mundo.
 */
export async function createTagAction(input: {
  name: string
  color: string
}): Promise<ActionResult<Tag>> {
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: parsed.data.name, color: normalizeTagColor(parsed.data.color) })
    .select("id, name, color")
    .single()

  if (error) return fail(error)

  revalidatePath("/tags")
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
 * Itens do dono logado, de qualquer categoria, para o diálogo "Aplicar a
 * itens". Só os seus próprios: `entry_tags` só aceita insert/delete de quem é
 * dono do item (RLS), então não faz sentido listar item de outra pessoa aqui.
 */
export async function searchEntriesForTagAction(input: {
  tagId: string
  query: string
}): Promise<ActionResult<EntryPickerRow[]>> {
  const parsed = searchEntriesForTagSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase
    .from("entries")
    .select("id, name, entry_tags(tag_id), category:categories(id, name, icon)")
    .eq("owner_id", user.id)
    .order("name", { ascending: true })
    .limit(100)

  const search = parsed.data.query.trim()
  if (search) query = query.ilike("name", `%${search}%`)

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
