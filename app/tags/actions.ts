"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { normalizeTagColor } from "@/lib/domain/tags"
import type { Tag } from "@/lib/domain/types"
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
