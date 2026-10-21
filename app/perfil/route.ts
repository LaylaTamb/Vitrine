import { NextResponse, type NextRequest } from "next/server"

import { profilePath } from "@/lib/domain/username"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * `/perfil` — atalho para o SEU perfil (`/v/<@>`), levando a query junto
 * (`/perfil?editar=1&steam=ok` → `/v/<@>?editar=1&steam=ok`). Serve a quem
 * não sabe o @ na hora: a volta do login da Steam, por exemplo. Sem login, o
 * middleware já mandou para o login antes de chegar aqui.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { search } = request.nextUrl
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?proximo=${encodeURIComponent(`/perfil${search}`)}`, request.url)
    )
  }

  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
  const username = (data as { username: string } | null)?.username
  return NextResponse.redirect(new URL(username ? `${profilePath(username)}${search}` : "/", request.url))
}
