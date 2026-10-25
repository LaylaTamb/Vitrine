"use server"

import { revalidatePath } from "next/cache"
import { toString as qrSvg } from "qrcode"

import { appOrigin } from "@/lib/actions/origin"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { profileTargetSchema, qrTokenSchema } from "@/lib/actions/schemas"
import { isMissingSchema } from "@/lib/domain/errors"
import {
  isQrToken,
  isRedeemStatus,
  QR_NOT_READY,
  qrLink,
  type RedeemStatus,
} from "@/lib/domain/qr"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Seguir, remover seguidor, bloquear (migração 14), o sininho (migração 21)
 * e o QR pessoal (migração 22). Os componentes importam direto daqui.
 */

const SOCIAL_NOT_READY =
  "Seguir ainda não está no banco: rode supabase/14_visibility_and_follows.sql no SQL Editor do Supabase."

function failSocial(error: unknown, denied: string): ActionResult<never> {
  if (isMissingSchema(error)) return { ok: false, error: SOCIAL_NOT_READY }
  const code = String((error as { code?: unknown })?.code ?? "")
  // A RLS recusa seguir quando há bloqueio entre os dois.
  if (code === "42501") return { ok: false, error: denied }
  return fail(error)
}

/** As telas que mostram seguidores, botões e o que é de Amigos leem de novo. */
function revalidateSocial() {
  revalidatePath("/v", "layout")
  revalidatePath("/usuarios")
  revalidatePath("/categoria", "layout")
}

type Target =
  | { refused: ActionResult<never> }
  | {
      refused: null
      userId: string
      profileId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }

/** Valida o outro perfil e recusa a ação sobre o próprio perfil. */
async function target(input: { profileId: string }): Promise<Target> {
  const parsed = profileTargetSchema.safeParse(input)
  if (!parsed.success) return { refused: failValidation(parsed.error.issues) }
  const user = await requireUser()
  if (parsed.data.profileId === user.id) {
    return { refused: { ok: false, error: "Essa ação não vale para o seu próprio perfil." } }
  }
  return {
    refused: null,
    userId: user.id,
    profileId: parsed.data.profileId,
    supabase: await createClient(),
  }
}

/** Seguir. Seguir de novo quem já segue não muda nada. */
export async function followAction(input: { profileId: string }): Promise<ActionResult> {
  const context = await target(input)
  if (context.refused) return context.refused
  const { userId, profileId, supabase } = context

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: userId, followee_id: profileId })
  if (error && String(error.code) !== "23505") {
    return failSocial(error, "Não dá para seguir este perfil.")
  }
  revalidateSocial()
  return ok()
}

export async function unfollowAction(input: { profileId: string }): Promise<ActionResult> {
  const context = await target(input)
  if (context.refused) return context.refused
  const { userId, profileId, supabase } = context

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", userId)
    .eq("followee_id", profileId)
  if (error) return failSocial(error, "Não deu para deixar de seguir.")
  revalidateSocial()
  return ok()
}

/** Tirar alguém dos SEUS seguidores (sem bloquear: a pessoa pode seguir de novo). */
export async function removeFollowerAction(input: { profileId: string }): Promise<ActionResult> {
  const context = await target(input)
  if (context.refused) return context.refused
  const { userId, profileId, supabase } = context

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", profileId)
    .eq("followee_id", userId)
  if (error) return failSocial(error, "Não deu para remover esse seguidor.")
  revalidateSocial()
  return ok()
}

/**
 * Bloquear: o banco desfaz os follows nos dois sentidos, impede novos e
 * esconde tudo de um para o outro. A pessoa bloqueada não é avisada.
 */
export async function blockAction(input: { profileId: string }): Promise<ActionResult> {
  const context = await target(input)
  if (context.refused) return context.refused
  const { userId, profileId, supabase } = context

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: userId, blocked_id: profileId })
  if (error && String(error.code) !== "23505") {
    return failSocial(error, "Não deu para bloquear.")
  }
  revalidateSocial()
  return ok()
}

export async function unblockAction(input: { profileId: string }): Promise<ActionResult> {
  const context = await target(input)
  if (context.refused) return context.refused
  const { userId, profileId, supabase } = context

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", profileId)
  if (error) return failSocial(error, "Não deu para desbloquear.")
  revalidateSocial()
  return ok()
}

// ---------------------------------------------------------------------------
// O sininho (migração 21)
// ---------------------------------------------------------------------------

/** As 30 notificações mais recentes. Sem a migração 21: nenhuma. */
/** Marca todas como lidas (o que a pessoa acabou de ver no sininho). */
export async function markNotificationsReadAction(): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("mark_notifications_read")
  if (error && !isMissingSchema(error)) return fail(error)
  return ok()
}

// ---------------------------------------------------------------------------
// QR pessoal (migração 22)
// ---------------------------------------------------------------------------

export interface QrCode {
  /** O QR pronto, em SVG (gerado aqui: a biblioteca não vai para o navegador). */
  svg: string
  expiresAt: string
}

/** Um código novo para a tela "Meu QR" e o QR do link com ele. */
export async function issueQrAction(): Promise<ActionResult<QrCode>> {
  await requireUser()
  const supabase = await createClient()
  const [{ data, error }, profile, origin] = await Promise.all([
    supabase.rpc("issue_qr_token"),
    getMyProfile(),
    appOrigin(),
  ])
  if (error) return isMissingSchema(error) ? { ok: false, error: QR_NOT_READY } : fail(error)
  const issued = data as { token?: unknown; expires_at?: unknown } | null
  if (!profile || !isQrToken(issued?.token) || typeof issued.expires_at !== "string") {
    return { ok: false, error: "Não deu para gerar o QR agora. Tente de novo." }
  }
  const svg = await qrSvg(qrLink(origin, profile.username, issued.token), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#131315", light: "#ffffff" },
  })
  return ok({ svg, expiresAt: issued.expires_at })
}

/** Quem escaneou: vira amigo do dono do QR (o banco confere tudo). */
export async function redeemQrAction(input: {
  token: string
}): Promise<ActionResult<{ status: RedeemStatus; username: string }>> {
  const parsed = qrTokenSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("redeem_qr", { p_token: parsed.data.token })
  if (error) return isMissingSchema(error) ? { ok: false, error: QR_NOT_READY } : fail(error)
  const result = data as { status?: unknown; username?: unknown } | null
  const status = isRedeemStatus(result?.status) ? result.status : "invalid"
  if (status === "friends") revalidateSocial()
  return ok({ status, username: typeof result?.username === "string" ? result.username : "" })
}
