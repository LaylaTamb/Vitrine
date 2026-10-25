import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"

import { appOrigin } from "@/lib/actions/origin"
import { isMissingSchema } from "@/lib/domain/errors"
import { checkOpenIdReturn } from "@/lib/domain/steam"
import { fetchPersonaName, serverSecret, verifyOpenId } from "@/lib/steam/client"
import { STEAM_STATE_COOKIE, STEAM_STATE_PATH } from "@/lib/steam/state"
import { syncSteamAccount } from "@/lib/steam/sync"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
// Liga a conta e já traz os jogos: a primeira sincronização pode demorar.
export const maxDuration = 60

/**
 * `/api/steam/retorno` — a volta do login da Steam. Confere o estado (o
 * cookie), a mensagem do OpenID e pergunta à Steam se ela é legítima
 * (`check_authentication`); só então liga o SteamID ao perfil
 * (`steam_connect`) e faz a primeira sincronização. Termina sempre no
 * Configurações → Steam (`/configuracoes?secao=steam`), com o recado em `?steam=`.
 */
export async function GET(request: NextRequest) {
  const origin = await appOrigin()
  const params = request.nextUrl.searchParams

  function back(status: string) {
    const response = NextResponse.redirect(`${origin}/configuracoes?secao=steam&steam=${status}`)
    response.cookies.set(STEAM_STATE_COOKIE, "", { path: STEAM_STATE_PATH, maxAge: 0 })
    return response
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?proximo=${encodeURIComponent("/configuracoes?secao=steam")}`)
  }

  const expected = request.cookies.get(STEAM_STATE_COOKIE)?.value
  const state = params.get("estado")
  if (!expected || !state || state !== expected) return back("invalido")

  const check = checkOpenIdReturn(params, `${origin}/api/steam/retorno`)
  if (!check.ok) return back(check.reason === "cancelled" ? "cancelado" : "invalido")

  try {
    if (!(await verifyOpenId(check.verification))) return back("invalido")
  } catch {
    return back("erro")
  }

  const secret = serverSecret()
  if (!secret) return back("sem-chave")

  const { data, error } = await supabase.rpc("steam_connect", {
    p_secret: secret,
    p_user: user.id,
    p_steam_id: check.steamId,
    p_display_name: await fetchPersonaName(check.steamId),
  })
  if (error) {
    if (isMissingSchema(error)) return back("sem-banco")
    return back(String((error as { code?: unknown }).code) === "42501" ? "segredo" : "erro")
  }
  if ((data as { status?: unknown } | null)?.status === "taken") return back("ocupada")

  // A primeira sincronização. Se ela falhar por outro motivo que não o perfil
  // privado, a conexão já vale: a tela mostra o erro e o "Sincronizar agora".
  const sync = await syncSteamAccount(supabase, user.id, check.steamId)
  revalidatePath("/", "layout")
  return back(!sync.ok && sync.reason === "private" ? "privado" : "ok")
}
