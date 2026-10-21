import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { serverSecret } from "@/lib/steam/client"
import { createAnonClient } from "@/lib/supabase/anon"

export const dynamic = "force-dynamic"

/** Compara sem deixar o tempo de resposta contar quantos caracteres bateram. */
function sameSecret(received: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(received), digest(expected))
}

/**
 * `/api/cron/lixeira` — a limpeza diária da Lixeira (migração 37): o que
 * passou de 30 dias some de vez, de todo mundo. Quem chama é o Cron da
 * Vercel (`vercel.json`), com `Authorization: Bearer <CRON_SECRET>`; o banco
 * confere o mesmo segredo (`purge_expired_trash`). Sem o segredo configurado,
 * a limpeza acontece só quando cada pessoa abre a própria lixeira.
 */
export async function GET(request: Request) {
  const secret = serverSecret()
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 })
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { data, error } = await createAnonClient().rpc("purge_expired_trash", { p_secret: secret })
  if (error) {
    return NextResponse.json({ error: "Não deu para limpar a lixeira." }, { status: 500 })
  }
  return NextResponse.json({ purged: typeof data === "number" ? data : 0 })
}
