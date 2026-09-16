import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Destino do magic link. Fluxo PKCE: o link traz `?code=`, trocamos por sessão
 * e seguimos. (A v1 era obrigada a usar o fluxo implícito, com o token no
 * fragmento da URL, por limitação do Reflex.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get("code")
  const next = searchParams.get("proximo")
  const destination = next?.startsWith("/") ? next : "/"

  // O Supabase pode redirecionar já com erro (link expirado, por exemplo).
  const errorCode =
    searchParams.get("error_code") ?? searchParams.get("error_description") ?? searchParams.get("error")
  if (errorCode) {
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(errorCode)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=invalid_token`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const reason = error.code ?? error.message
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(reason)}`)
  }

  return NextResponse.redirect(`${origin}${destination}`)
}
