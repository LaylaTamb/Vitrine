"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { favoriteEntrySchema, favoritesTabSchema } from "@/lib/actions/schemas"
import { isMissingSchema } from "@/lib/domain/errors"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Favoritos (migração 20): a estrelinha do item preferido de cada categoria e
 * a aba Favoritos (categorias inteiras, na ordem).
 * Tudo numa tabela que só o dono lê — ninguém mais vê o que é favorito.
 */

const FAVORITES_NOT_READY =
  "Os favoritos ainda não estão no banco: rode supabase/20_favorites.sql no SQL Editor do Supabase."

function failFavorites(error: unknown): ActionResult<never> {
  return isMissingSchema(error) ? { ok: false, error: FAVORITES_NOT_READY } : fail(error)
}

/** Marca (ou troca, ou desmarca) o favorito de uma categoria. A posição na aba fica como está. */
export async function setFavoriteEntryAction(input: {
  categoryId: string
  entryId: string | null
}): Promise<ActionResult> {
  const parsed = favoriteEntrySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { categoryId, entryId } = parsed.data

  // Desmarcar não precisa criar linha: só solta o favorito, se houver.
  const { error } = entryId
    ? await supabase
        .from("category_favorites")
        .upsert(
          { category_id: categoryId, owner_id: user.id, entry_id: entryId },
          { onConflict: "category_id" }
        )
    : await supabase
        .from("category_favorites")
        .update({ entry_id: null })
        .eq("category_id", categoryId)
        .eq("owner_id", user.id)

  if (error) return failFavorites(error)
  revalidatePath(`/categoria/${categoryId}`, "layout")
  revalidatePath("/favoritos")
  return ok()
}

/**
 * Grava a aba Favoritos inteira (as categorias), na ordem. Quem saiu da lista sai da aba —
 * o favorito da categoria continua marcado.
 */
export async function setFavoritesTabAction(input: {
  categoryIds: string[]
}): Promise<ActionResult> {
  const parsed = favoritesTabSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { categoryIds } = parsed.data

  let clear = supabase
    .from("category_favorites")
    .update({ tab_position: null })
    .eq("owner_id", user.id)
    .not("tab_position", "is", null)
  if (categoryIds.length > 0) clear = clear.not("category_id", "in", `(${categoryIds.join(",")})`)

  // Linhas diferentes: as duas escritas vão juntas.
  const [cleared, placed] = await Promise.all([
    clear,
    categoryIds.length > 0
      ? supabase.from("category_favorites").upsert(
          categoryIds.map((id, index) => ({
            category_id: id,
            owner_id: user.id,
            tab_position: index,
          })),
          { onConflict: "category_id" }
        )
      : Promise.resolve({ error: null }),
  ])
  if (cleared.error) return failFavorites(cleared.error)
  if (placed.error) return failFavorites(placed.error)

  revalidatePath("/favoritos")
  return ok()
}
