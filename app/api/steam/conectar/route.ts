import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"

import { appOrigin } from "@/lib/actions/origin"
import { openIdLoginUrl } from "@/lib/domain/steam"
import { steamConfigured } from "@/lib/steam/client"
import { STEAM_STATE_COOKIE, STEAM_STATE_MAX_AGE, STEAM_STATE_PATH } from "@/lib/steam/state"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * `/api/steam/conectar` — o botão "Conectar Steam" das Configurações. Manda
 * para o login da própria Steam (OpenID): a senha da Steam nunca passa pelo
 * Vitrine. Volta em `/api/steam/retorno`.
 */
export async function GET() {
  const origin = await appOrigin()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?proximo=${encodeURIComponent("/configuracoes")}`)
  }
  if (!steamConfigured()) {
    return NextResponse.redirect(`${origin}/configuracoes?steam=sem-chave#aplicativos`)
  }

  const state = randomBytes(16).toString("hex")
  const returnTo = `${origin}/api/steam/retorno?estado=${state}`
  const response = NextResponse.redirect(openIdLoginUrl(returnTo, origin))
  response.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: STEAM_STATE_PATH,
    maxAge: STEAM_STATE_MAX_AGE,
  })
  return response
}
