"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  bringFromMatchSchema,
  createMatchSchema,
  openMatchSchema,
  respondMatchSchema,
} from "@/lib/actions/schemas"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import { INBOX_LOCATION_FIELD_ID } from "@/lib/domain/inbox"
import {
  MATCH_COPY_NOT_READY,
  MATCHES_NOT_READY,
  matchLocation,
  matchOrigin,
  type MatchStatus,
} from "@/lib/domain/match"
import type { EntryPlace } from "@/lib/domain/types"
import { formatFieldValue } from "@/lib/domain/view"
import { getMyInboxId } from "@/lib/queries/inbox"
import { getMyFriends } from "@/lib/queries/matches"
import { requireUser } from "@/lib/queries/session"
import type { ListProfile } from "@/lib/queries/social"
import { createClient } from "@/lib/supabase/server"

/**
 * Match (migração 30). As regras — só amigos, até 8 pessoas, todos aceitam,
 * uma recusa cancela — moram nas funções do banco; aqui só validamos a
 * entrada e traduzimos o erro.
 */

function failMatch(error: unknown): ActionResult<never> {
  if (isMissingSchema(error)) return { ok: false, error: MATCHES_NOT_READY }
  const message = String((error as { message?: unknown })?.message ?? "")
  const code = String((error as { code?: unknown })?.code ?? "")
  // As mensagens das funções já vêm em português (raise exception).
  if (["22023", "42501", "54000", "P0002"].includes(code) && message) {
    return { ok: false, error: message }
  }
  return fail(error)
}

/** Os amigos para escolher no "Novo match". */
export async function matchFriendsAction(): Promise<ActionResult<ListProfile[]>> {
  const user = await requireUser()
  return ok(await getMyFriends(user.id))
}

/** Chama até 7 amigos. Quem cria já aceitou; os outros recebem o convite no sininho. */
export async function createMatchAction(input: {
  userIds: string[]
}): Promise<ActionResult<{ matchId: string }>> {
  const parsed = createMatchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_match", { p_user_ids: parsed.data.userIds })
  if (error) return failMatch(error)
  revalidatePath("/matches")
  return ok({ matchId: String(data) })
}

/** Aceitar ou recusar (quem criou: cancelar). Uma recusa cancela o match. */
export async function respondMatchAction(input: {
  matchId: string
  accept: boolean
}): Promise<ActionResult<{ status: MatchStatus }>> {
  const parsed = respondMatchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("respond_match", {
    p_match_id: parsed.data.matchId,
    p_accept: parsed.data.accept,
  })
  if (error) return failMatch(error)
  const status = (data as { status?: unknown } | null)?.status
  revalidatePath("/matches")
  revalidatePath("/", "layout")
  return ok({
    status: status === "ready" || status === "canceled" ? status : "pending",
  })
}

/**
 * Abre a sua cópia de um match pronto (migração 31). Na primeira vez o banco
 * monta (`build_my_match_copy`): uma foto do momento, que não atualiza;
 * depois devolve a mesma.
 */
export async function openMatchAction(input: {
  matchId: string
}): Promise<ActionResult<{ categoryId: string }>> {
  const parsed = openMatchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("build_my_match_copy", {
    p_match_id: parsed.data.matchId,
  })
  if (error) {
    if (isMissingSchema(error) || isMissingColumn(error)) {
      return { ok: false, error: MATCH_COPY_NOT_READY }
    }
    return failMatch(error)
  }
  // A pasta "Matches" e a categoria nova aparecem nas Coleções.
  revalidatePath("/")
  return ok({ categoryId: String(data) })
}

/** Quem trouxe fica registrado assim: "trazer" + o item da cópia (trazer de novo não duplica). */
const BRING_SOURCE = "trazer"

/**
 * "Trazer": copia um item da cópia do match para a sua A organizar — nome,
 * imagem e a localização (já encontrada, se o original tinha). Sem a nota do
 * outro: a sua você dá depois.
 */
export async function bringFromMatchAction(input: {
  entryId: string
}): Promise<ActionResult<{ entryId: string; categoryId: string; already: boolean }>> {
  const parsed = bringFromMatchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("entries")
    .select("id, name, image_url, image_display, match_owner_id, match_fields, category:categories(kind)")
    .eq("id", parsed.data.entryId)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (error) return isMissingColumn(error) ? { ok: false, error: MATCH_COPY_NOT_READY } : fail(error)

  const entry = row as {
    id: string
    name: string
    image_url: string | null
    image_display: unknown
    match_owner_id: string | null
    match_fields: unknown
    category: { kind?: string } | null
  } | null
  if (!entry || entry.category?.kind !== "match") {
    return { ok: false, error: "Esse item não está na cópia de um match." }
  }
  if (entry.match_owner_id === user.id) {
    return { ok: false, error: "Esse já é seu: ele continua na categoria de onde veio." }
  }

  const inboxId = await getMyInboxId(user.id)
  if (!inboxId) return { ok: false, error: "Não achei a sua A organizar. Recarregue a página." }

  const findBrought = async () => {
    const { data } = await supabase
      .from("entries")
      .select("id, category_id")
      .eq("owner_id", user.id)
      .eq("source", BRING_SOURCE)
      .eq("source_id", entry.id)
      .maybeSingle()
    return data as { id: string; category_id: string } | null
  }
  const brought = await findBrought()
  if (brought) return ok({ entryId: brought.id, categoryId: brought.category_id, already: true })

  const location = matchLocation(matchOrigin(entry.match_fields, formatFieldValue))

  const { data: top } = await supabase
    .from("entries")
    .select("display_order")
    .eq("category_id", inboxId)
    .is("folder_id", null)
    .order("display_order", { ascending: false })
    .limit(1)
  const last = (top ?? [])[0] as { display_order: number } | undefined

  const { data: created, error: insertError } = await supabase
    .from("entries")
    .insert({
      category_id: inboxId,
      owner_id: user.id,
      name: entry.name.slice(0, 200),
      rating: null,
      image_url: entry.image_url,
      image_display: entry.image_display ?? {},
      custom_fields: location ? { [INBOX_LOCATION_FIELD_ID]: location.address } : {},
      display_order: (last?.display_order ?? -1) + 1,
      source: BRING_SOURCE,
      source_id: entry.id,
    })
    .select("id")
    .single()
  if (insertError) {
    // Dois toques ao mesmo tempo: o índice único segura, e vale o primeiro.
    const again = String((insertError as { code?: unknown }).code) === "23505" ? await findBrought() : null
    if (again) return ok({ entryId: again.id, categoryId: again.category_id, already: true })
    return fail(insertError)
  }
  const entryId = (created as { id: string }).id

  if (location) {
    // A localização já encontrada vai junto: aparece no Mapa na hora. Sem
    // ela, o endereço fica no campo e o Mapa procura depois.
    const { data: placeRow } = await supabase
      .from("entry_places")
      .select("*")
      .eq("entry_id", entry.id)
      .eq("field_id", location.fieldId)
      .maybeSingle()
    const place = placeRow as EntryPlace | null
    if (place && place.status === "ok") {
      await supabase.from("entry_places").upsert(
        {
          entry_id: entryId,
          field_id: INBOX_LOCATION_FIELD_ID,
          owner_id: user.id,
          address: location.address,
          formatted_address: place.formatted_address,
          lat: place.lat,
          lng: place.lng,
          place_id: place.place_id,
          status: "ok",
          geocoded_at: place.geocoded_at,
          place_name: place.place_name ?? null,
          result_type: place.result_type ?? null,
          osm_id: place.osm_id ?? null,
        },
        { onConflict: "entry_id,field_id" }
      )
    }
  }

  revalidatePath("/")
  revalidatePath("/mapa")
  revalidatePath(`/categoria/${inboxId}`)
  return ok({ entryId, categoryId: inboxId, already: false })
}
