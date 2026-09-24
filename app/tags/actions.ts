"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { normalizeTagColor } from "@/lib/domain/tags"
import type { Tag } from "@/lib/domain/types"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

const uuid = z.uuid("Identificador inválido.")

const tagSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à tag.").max(40, "Nome muito longo."),
  color: z.string(),
})

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
  const parsed = tagSchema.extend({ id: uuid }).safeParse(input)
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
  const parsed = z.object({ id: uuid }).safeParse(input)
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

export interface EntryPickerRow {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  /** Já tem essa tag — aparece marcado e travado na lista. */
  hasTag: boolean
}

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
  const parsed = z
    .object({ tagId: uuid, query: z.string().max(160) })
    .safeParse(input)
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

const applyTagSchema = z.object({
  tagId: uuid,
  ids: z.array(uuid).min(1, "Selecione pelo menos um item."),
})

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
