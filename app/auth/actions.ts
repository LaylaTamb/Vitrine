"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { appOrigin } from "@/lib/actions/origin"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  acceptTermsSchema,
  deleteAccountSchema,
  newPasswordSchema,
  passwordResetSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/actions/schemas"
import { safeNextPath } from "@/lib/domain/auth"
import { isMissingSchema, translateError } from "@/lib/domain/errors"
import { deleteConfirmationMatches, termsAcceptance } from "@/lib/domain/terms"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Conta por e-mail e senha, toda no Supabase Auth: ele guarda a senha (com
 * hash), emite a sessão em cookies httpOnly (`@supabase/ssr`) e manda os
 * e-mails com links temporários. O app só valida a entrada e traduz os erros.
 *
 * Regra de ouro: nenhuma mensagem diz se um e-mail tem conta ou não.
 */

/** Login que falhou porque o e-mail ainda não foi confirmado: a tela oferece reenviar. */
export type SignInResult = { ok: false; error: string; unconfirmed?: boolean }

/** Erros que vale mostrar mesmo nas telas que não revelam nada: limite de envio e rede. */
function isServiceTrouble(error: unknown): boolean {
  const text = String((error as { message?: unknown })?.message ?? error).toLowerCase()
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase()
  return (
    code.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("fetch failed") ||
    text.includes("failed to fetch")
  )
}

// ---------------------------------------------------------------------------
// Entrar e sair
// ---------------------------------------------------------------------------

export async function signInAction(input: {
  email: string
  password: string
  next?: string
}): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira o e-mail e a senha." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return {
      ok: false,
      error: translateError(error),
      unconfirmed: error.code === "email_not_confirmed",
    }
  }

  revalidatePath("/", "layout")
  redirect(safeNextPath(input.next))
}

/** Manda de novo o link de confirmação do cadastro. Resposta sempre igual. */
export async function resendConfirmationAction(input: { email: string }): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await appOrigin()}/auth/callback` },
  })
  if (error && isServiceTrouble(error)) return fail(error)
  return ok()
}

// ---------------------------------------------------------------------------
// Criar conta
// ---------------------------------------------------------------------------

export async function signUpAction(input: {
  email: string
  password: string
  confirm: string
  /** A caixa dos 18 anos + Termos + Política — conferida aqui também. */
  acceptTerms: boolean
}): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await appOrigin()}/auth/callback`,
      // O aceite vai junto da conta; o banco copia para o perfil quando ele
      // nascer, na confirmação do e-mail (migração 16).
      data: termsAcceptance(new Date()),
    },
  })

  if (error) {
    // E-mail que já tem conta (com a confirmação desligada, o Supabase diz):
    // a resposta é a mesma de sempre, para não revelar quem tem conta.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return ok({ confirmEmail: true })
    }
    return fail(error)
  }

  // Confirmação de e-mail desligada no Supabase: a conta já entra.
  if (data.session) {
    revalidatePath("/", "layout")
    redirect("/")
  }

  // Ligada (o recomendado): a conta só entra depois do link. Com e-mail que
  // já tinha conta o Supabase não manda nada — e não conta. A tela também não.
  return ok({ confirmEmail: true })
}

// ---------------------------------------------------------------------------
// Termos: o aceite de quem já tinha conta (ou de quando a versão muda)
// ---------------------------------------------------------------------------

/**
 * Grava o aceite no `user_metadata` da conta — é ali que o middleware olha a
 * cada requisição — e segue para onde a pessoa ia. O banco copia para o
 * perfil (migração 16).
 */
export async function acceptTermsAction(input: {
  acceptTerms: boolean
  next?: string
}): Promise<ActionResult> {
  const parsed = acceptTermsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: termsAcceptance(new Date()) })
  if (error) return fail(error)

  revalidatePath("/", "layout")
  const next = safeNextPath(parsed.data.next)
  redirect(next.startsWith("/aceitar-termos") ? "/" : next)
}

// ---------------------------------------------------------------------------
// Excluir a conta
// ---------------------------------------------------------------------------

/**
 * Apaga a conta de quem está logado e tudo o que é dela (migração 16: as
 * cascatas do banco levam perfil, acervo e relações). Confere antes que a
 * pessoa digitou o próprio @. Deu certo: limpa a sessão daqui e volta para o
 * login com o aviso.
 */
export async function deleteAccountAction(input: { confirm: string }): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle()
  const username = (profile as { username: string } | null)?.username ?? ""
  if (!deleteConfirmationMatches(parsed.data.confirm, username)) {
    return { ok: false, error: `Para confirmar, digite o seu @ (@${username || "…"}).` }
  }

  const { error } = await supabase.rpc("delete_my_account")
  if (error) {
    return isMissingSchema(error)
      ? {
          ok: false,
          error:
            "Excluir a conta ainda não está no banco: rode supabase/16_terms_and_account_deletion.sql no SQL Editor do Supabase.",
        }
      : fail(error)
  }

  // A conta já não existe: o Supabase recusa o "sair" no servidor, mas os
  // cookies daqui são apagados do mesmo jeito.
  await supabase.auth.signOut({ scope: "local" })
  revalidatePath("/", "layout")
  redirect("/login?conta=excluida")
}

// ---------------------------------------------------------------------------
// Senha: pedir o link e gravar a nova
// ---------------------------------------------------------------------------

/**
 * Manda o link de redefinição — que também serve para quem nunca teve senha
 * (as contas da época do link por e-mail). A resposta é a mesma exista ou
 * não a conta.
 */
export async function requestPasswordResetAction(input: {
  email: string
}): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}/auth/callback`,
  })
  if (error && isServiceTrouble(error)) return fail(error)
  return ok()
}

/**
 * Grava a senha de quem está logado — depois do link de redefinição, ou nas
 * Configurações. As outras sessões da conta caem: se a troca foi por
 * suspeita, ninguém continua dentro com a senha velha.
 */
export async function updatePasswordAction(input: {
  password: string
  confirm: string
}): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sua sessão expirou. Peça um novo link para criar a senha." }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return fail(error)

  await supabase.auth.signOut({ scope: "others" })
  return ok()
}
