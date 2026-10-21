"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { idSchema } from "@/lib/actions/schemas"
import { isMissingSchema } from "@/lib/domain/errors"
import { parseRestoreResult, TRASH_NOT_READY, type RestoreResult } from "@/lib/domain/trash"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * A Lixeira (migração 37): restaurar, excluir de vez e esvaziar. As regras
 * (só o dono, para onde volta, nome repetido) moram nas funções do banco.
 */

function failTrash(error: unknown): ActionResult<never> {
  if (isMissingSchema(error)) return { ok: false, error: TRASH_NOT_READY }
  const message = String((error as { message?: unknown })?.message ?? "")
  const code = String((error as { code?: unknown })?.code ?? "")
  // As mensagens das funções já vêm em português (raise exception).
  if (["22023", "42501", "P0002"].includes(code) && message) return { ok: false, error: message }
  return fail(error)
}

/** Devolve a pasta, a categoria ou a subpasta para onde estava (ou para a raiz). */
export async function restoreTrashAction(input: {
  id: string
}): Promise<ActionResult<RestoreResult>> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("restore_trash_item", { p_id: parsed.data.id })
  if (error) return failTrash(error)

  const result = parseRestoreResult(data)
  revalidatePath("/lixeira")
  revalidatePath("/")
  if (result.kind === "entry_folder" && result.categoryId) {
    revalidatePath(`/categoria/${result.categoryId}`)
  }
  return ok(result)
}

/** Exclui de vez, agora (sem esperar os 30 dias). */
export async function deleteTrashItemAction(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("delete_trash_item", { p_id: parsed.data.id })
  if (error) return failTrash(error)
  revalidatePath("/lixeira")
  revalidatePath("/")
  return ok()
}

/** Esvazia a lixeira inteira, agora. */
export async function emptyTrashAction(): Promise<ActionResult<{ count: number }>> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("empty_my_trash")
  if (error) return failTrash(error)
  revalidatePath("/lixeira")
  revalidatePath("/")
  return ok({ count: typeof data === "number" ? data : 0 })
}
