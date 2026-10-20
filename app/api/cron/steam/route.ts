import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { STEAM_ID_PATTERN } from "@/lib/domain/steam"
import { serverSecret, steamApiKey } from "@/lib/steam/client"
import { syncSteamAccount } from "@/lib/steam/sync"
import { createAnonClient } from "@/lib/supabase/anon"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Para antes do limite da função (60 s): o resto fica para a rodada seguinte. */
const BUDGET_MS = 45_000
const BATCH = 25

/** Compara sem deixar o tempo de resposta contar quantos caracteres bateram. */
function sameSecret(received: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(received), digest(expected))
}

/**
 * `/api/cron/steam` — a atualização diária da Steam. Quem chama é o Cron da
 * Vercel (`vercel.json`), que manda `Authorization: Bearer <CRON_SECRET>`.
 * Sem sessão de ninguém: grava pelas funções do banco que abrem com o mesmo
 * segredo (migração 24), uma conta por vez, as mais antigas primeiro.
 */
export async function GET(request: Request) {
  const secret = serverSecret()
  if (!secret || !steamApiKey()) {
    return NextResponse.json({ error: "Steam não configurada no servidor." }, { status: 503 })
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.rpc("steam_due_accounts", {
    p_secret: secret,
    p_limit: BATCH,
  })
  if (error) {
    return NextResponse.json({ error: "Não deu para ler as contas da Steam." }, { status: 500 })
  }

  const accounts = (Array.isArray(data) ? data : []).flatMap((raw) => {
    const row = raw as { user_id?: unknown; steam_id?: unknown }
    return typeof row.user_id === "string" &&
      typeof row.steam_id === "string" &&
      STEAM_ID_PATTERN.test(row.steam_id)
      ? [{ userId: row.user_id, steamId: row.steam_id }]
      : []
  })

  const started = Date.now()
  const summary = { synced: 0, failed: 0, left: 0 }
  for (const account of accounts) {
    if (Date.now() - started > BUDGET_MS) {
      summary.left += 1
      continue
    }
    const result = await syncSteamAccount(supabase, account.userId, account.steamId, {
      refreshName: true,
    })
    if (result.ok) summary.synced += 1
    else summary.failed += 1
  }

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } })
}
