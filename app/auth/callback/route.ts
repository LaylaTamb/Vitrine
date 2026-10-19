import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { authMethodsOf, needsNewPassword, safeNextPath } from "@/lib/domain/auth"
import { createClient } from "@/lib/supabase/server"

/** Os tipos de link que os e-mails do app mandam (ver "Modelos de e-mail" no README). */
const LINK_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "email_change"]

/**
 * Destino dos links dos e-mails: confirmar o cadastro, redefinir a senha,
 * aceitar um convite. Troca o token do link por uma sessão (cookies httpOnly)
 * e segue:
 *
 * - `?token_hash=…&type=…` — o formato dos modelos de e-mail do README. Vale
 *   em qualquer navegador, mesmo outro que não o do pedido.
 * - `?code=…` — o fluxo PKCE, com os modelos padrão do Supabase. Só vale no
 *   mesmo navegador que pediu o e-mail (o verificador fica num cookie dele).
 *
 * Quem chega por recuperação ou convite vai criar a senha; o resto, para o
 * app (ou para `?proximo=`, se for um caminho interno).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const toLogin = (reason: string) =>
    NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(reason)}`)

  // O Supabase pode redirecionar já com erro (link expirado, por exemplo).
  const errorCode =
    searchParams.get("error_code") ?? searchParams.get("error_description") ?? searchParams.get("error")
  if (errorCode) return toLogin(errorCode)

  const supabase = await createClient()
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")

  if (tokenHash && type && LINK_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return toLogin(error.code ?? error.message)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return toLogin(error.code ?? error.message)
  } else {
    return toLogin("invalid_token")
  }

  // O token novo diz por onde a pessoa entrou: recuperação e convite vão
  // direto criar a senha (a conta pode nem ter uma ainda).
  const { data } = await supabase.auth.getClaims()
  const methods = authMethodsOf(data?.claims?.amr)
  if (type === "recovery" || type === "invite" || needsNewPassword(methods)) {
    return NextResponse.redirect(`${origin}/redefinir-senha`)
  }

  return NextResponse.redirect(`${origin}${safeNextPath(searchParams.get("proximo"))}`)
}
