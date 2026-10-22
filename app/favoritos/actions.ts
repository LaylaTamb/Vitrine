"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { categoryFavoriteSchema, favoritesTabSchema } from "@/lib/actions/schemas"
import { isMissingSchema } from "@/lib/domain/errors"
import { canFavorite, nextTabPosition } from "@/lib/domain/favorites"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Favoritos (migração 20): a estrela de uma categoria e a ordem das
 * favoritas. Tudo numa tabela que só o dono lê — ninguém mais vê o que é
 * favorito.
 */

const FAVORITES_NOT_READY =
  "Os favoritos ainda não estão no banco: rode supabase/20_favorites.sql no SQL Editor do Supabase."

function failFavorites(error: unknown): ActionResult<never> {
  return isMissingSchema(error) ? { ok: false, error: FAVORITES_NOT_READY } : fail(error)
}

/** As telas que mostram a estrela de uma categoria. */
function revalidateFavorites(categoryId: string) {
  revalidatePath("/")
  revalidatePath("/favoritos")
  revalidatePath(`/categoria/${categoryId}`, "layout")
}

/**
 * Marca (no fim da lista das favoritas) ou desmarca uma categoria. A
 * categoria não sai do lugar nas Coleções. Quem confere que ela é da pessoa
 * é a RLS da tabela.
 */
export async function setCategoryFavoriteAction(input: {
  categoryId: string
  favorite: boolean
}): Promise<ActionResult> {
  const parsed = categoryFavoriteSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { categoryId, favorite } = parsed.data

  if (!favorite) {
    // Desmarcar não precisa criar linha: só solta a posição, se houver.
    const { error } = await supabase
      .from("category_favorites")
      .update({ tab_position: null })
      .eq("category_id", categoryId)
      .eq("owner_id", user.id)
    if (error) return failFavorites(error)
    revalidateFavorites(categoryId)
    return ok()
  }

  const [categoryResult, positionsResult] = await Promise.all([
    supabase.from("categories").select("*").eq("id", categoryId).eq("owner_id", user.id).maybeSingle(),
    supabase
      .from("category_favorites")
      .select("category_id, tab_position")
      .eq("owner_id", user.id)
      .not("tab_position", "is", null),
  ])
  if (categoryResult.error) return fail(categoryResult.error)
  if (positionsResult.error) return failFavorites(positionsResult.error)
  const category = categoryResult.data as { kind?: string | null } | null
  if (!category) return { ok: false, error: "Categoria não encontrada." }
  if (!canFavorite(category)) {
    return { ok: false, error: "A “A organizar” não entra nos favoritos." }
  }

  const rows = (positionsResult.data ?? []) as { category_id: string; tab_position: number | null }[]
  // Já é favorita: fica onde está.
  if (rows.some((row) => row.category_id === categoryId)) return ok()

  const { error } = await supabase.from("category_favorites").upsert(
    {
      category_id: categoryId,
      owner_id: user.id,
      tab_position: nextTabPosition(rows.map((row) => row.tab_position)),
    },
    { onConflict: "category_id" }
  )
  if (error) return failFavorites(error)
  revalidateFavorites(categoryId)
  return ok()
}

/**
 * Grava a lista inteira das favoritas, na ordem (arrastar na tela das
 * favoritas). Quem saiu da lista deixa de ser favorita.
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

  revalidatePath("/")
  revalidatePath("/favoritos")
  return ok()
}
