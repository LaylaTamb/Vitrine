"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  bringFromBlendSchema,
  createMatchSchema,
  hideMatchSchema,
  respondMatchSchema,
} from "@/lib/actions/schemas"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import { INBOX_LOCATION_FIELD_ID } from "@/lib/domain/inbox"
import { MATCHES_NOT_READY, matchLocation, matchOrigin, type MatchStatus } from "@/lib/domain/match"
import type { EntryPlace } from "@/lib/domain/types"
import { formatFieldValue } from "@/lib/domain/view"
import { getMyInboxId } from "@/lib/queries/inbox"
import { getMatchById, getMyFriends } from "@/lib/queries/matches"
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

/** O erro de excluir da lista antes de a migração 34 rodar. */
const HIDE_NOT_READY =
  "Excluir da lista ainda não está no banco: rode supabase/34_match_common.sql no SQL Editor do Supabase."

/**
 * "Excluir" um match da sua lista (migração 34): some só para você — para os
 * outros, nada muda. Só pronto ou cancelado (o pendente se responde antes).
 */
export async function hideMatchAction(input: { matchId: string }): Promise<ActionResult> {
  const parsed = hideMatchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("hide_my_match", { p_match_id: parsed.data.matchId })
  if (error) {
    return isMissingSchema(error) || isMissingColumn(error)
      ? { ok: false, error: HIDE_NOT_READY }
      : failMatch(error)
  }
  revalidatePath("/matches")
  return ok()
}

/** Quem trouxe fica registrado assim: "trazer" + o item original (trazer de novo não duplica). */
const BRING_SOURCE = "trazer"

/**
 * "Trazer" da lista do match (migração 45): copia o item ORIGINAL de um amigo
 * do match para a sua A organizar — nome, imagem e a localização (já
 * encontrada, se o original tinha). Sem a nota dele: a sua você dá depois. A
 * RLS só deixa ler o que você pode ver.
 */
export async function bringFromBlendAction(input: {
  matchId: string
  entryId: string
}): Promise<ActionResult<{ entryId: string; categoryId: string; already: boolean }>> {
  const parsed = bringFromBlendSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const match = await getMatchById(parsed.data.matchId)
  if (!match || match.status !== "ready") return { ok: false, error: "Match não encontrado." }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("entries")
    .select(
      "id, owner_id, name, image_url, image_display, custom_fields, category:categories(estrutura)"
    )
    .eq("id", parsed.data.entryId)
    .maybeSingle()
  if (error) return fail(error)

  const entry = row as {
    id: string
    owner_id: string
    name: string
    image_url: string | null
    image_display: unknown
    custom_fields: unknown
    category: { estrutura?: unknown } | null
  } | null
  if (!entry || !match.members.some((member) => member.userId === entry.owner_id)) {
    return { ok: false, error: "Esse item não está mais à vista no match." }
  }
  if (entry.owner_id === user.id) {
    return { ok: false, error: "Esse já é seu: ele continua na categoria de onde veio." }
  }

  const result = await bringToInbox(supabase, user.id, {
    id: entry.id,
    name: entry.name,
    imageUrl: entry.image_url,
    imageDisplay: entry.image_display,
    location: matchLocation(
      matchOrigin(
        { estrutura: entry.category?.estrutura, values: entry.custom_fields },
        formatFieldValue
      )
    ),
  })
  if (result.ok) revalidatePath(`/matches/${match.id}`)
  return result
}

/**
 * O que o "Trazer" grava: o item na A organizar, com `source` "trazer" e o
 * `source_id` do item de onde veio (trazer de novo não duplica), e a
 * localização já encontrada desse item, se houver.
 */
async function bringToInbox(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  source: {
    id: string
    name: string
    imageUrl: string | null
    imageDisplay: unknown
    location: { fieldId: string; address: string } | null
  }
): Promise<ActionResult<{ entryId: string; categoryId: string; already: boolean }>> {
  const inboxId = await getMyInboxId(userId)
  if (!inboxId) return { ok: false, error: "Não achei a sua A organizar. Recarregue a página." }

  const findBrought = async () => {
    const { data } = await supabase
      .from("entries")
      .select("id, category_id")
      .eq("owner_id", userId)
      .eq("source", BRING_SOURCE)
      .eq("source_id", source.id)
      .maybeSingle()
    return data as { id: string; category_id: string } | null
  }
  const brought = await findBrought()
  if (brought) return ok({ entryId: brought.id, categoryId: brought.category_id, already: true })

  const location = source.location

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
      owner_id: userId,
      name: source.name.slice(0, 200),
      rating: null,
      image_url: source.imageUrl,
      image_display: source.imageDisplay ?? {},
      custom_fields: location ? { [INBOX_LOCATION_FIELD_ID]: location.address } : {},
      display_order: (last?.display_order ?? -1) + 1,
      source: BRING_SOURCE,
      source_id: source.id,
    })
    .select("id")
    .single()
  if (insertError) {
    // Dois toques ao mesmo tempo: o índice único segura, e vale o primeiro.
    const again =
      String((insertError as { code?: unknown }).code) === "23505" ? await findBrought() : null
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
      .eq("entry_id", source.id)
      .eq("field_id", location.fieldId)
      .maybeSingle()
    const place = placeRow as EntryPlace | null
    if (place && place.status === "ok") {
      await supabase.from("entry_places").upsert(
        {
          entry_id: entryId,
          field_id: INBOX_LOCATION_FIELD_ID,
          owner_id: userId,
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
