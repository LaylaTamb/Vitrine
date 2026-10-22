import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { isMissingSchema } from "@/lib/domain/errors"
import { STEAM_ID_PATTERN } from "@/lib/domain/steam"
import { normalizeLetterboxdUsername } from "@/lib/import/letterboxd-rss"
import { syncLetterboxdAccount } from "@/lib/letterboxd/sync"
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

type DueAccount = { userId: string; provider: "steam" | "letterboxd"; externalId: string }

/**
 * As contas da rodada: Steam e Letterboxd pela função da migração 39; sem
 * ela, só a Steam, pela do 24 (como antes).
 */
async function dueAccounts(
  supabase: ReturnType<typeof createAnonClient>,
  secret: string
): Promise<DueAccount[] | null> {
  const both = await supabase.rpc("connected_due_accounts", { p_secret: secret, p_limit: BATCH })
  if (!both.error) {
    return (Array.isArray(both.data) ? both.data : []).flatMap((raw): DueAccount[] => {
      const row = raw as { user_id?: unknown; provider?: unknown; external_id?: unknown }
      if (typeof row.user_id !== "string" || typeof row.external_id !== "string") return []
      if (row.provider === "steam" && STEAM_ID_PATTERN.test(row.external_id)) {
        return [{ userId: row.user_id, provider: "steam", externalId: row.external_id }]
      }
      if (row.provider === "letterboxd" && normalizeLetterboxdUsername(row.external_id)) {
        return [{ userId: row.user_id, provider: "letterboxd", externalId: row.external_id }]
      }
      return []
    })
  }
  if (!isMissingSchema(both.error)) return null

  const steam = await supabase.rpc("steam_due_accounts", { p_secret: secret, p_limit: BATCH })
  if (steam.error) return null
  return (Array.isArray(steam.data) ? steam.data : []).flatMap((raw) => {
    const row = raw as { user_id?: unknown; steam_id?: unknown }
    return typeof row.user_id === "string" &&
      typeof row.steam_id === "string" &&
      STEAM_ID_PATTERN.test(row.steam_id)
      ? [{ userId: row.user_id, provider: "steam" as const, externalId: row.steam_id }]
      : []
  })
}

/**
 * `/api/cron/contas` — a atualização diária das contas conectadas (Steam e
 * Letterboxd). Quem chama é o Cron da Vercel (`vercel.json`), que manda
 * `Authorization: Bearer <CRON_SECRET>`. Sem sessão de ninguém: grava pelas
 * funções do banco que abrem com o mesmo segredo (migrações 24 e 39), uma
 * conta por vez, as mais antigas primeiro. Sem a STEAM_API_KEY, as contas da
 * Steam ficam para quando ela existir.
 */
export async function GET(request: Request) {
  const secret = serverSecret()
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 })
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const supabase = createAnonClient()
  const accounts = await dueAccounts(supabase, secret)
  if (!accounts) {
    return NextResponse.json({ error: "Não deu para ler as contas conectadas." }, { status: 500 })
  }

  const steamReady = steamApiKey() !== null
  const started = Date.now()
  const summary = { synced: 0, failed: 0, left: 0, skipped: 0 }
  for (const account of accounts) {
    if (Date.now() - started > BUDGET_MS) {
      summary.left += 1
      continue
    }
    if (account.provider === "steam" && !steamReady) {
      summary.skipped += 1
      continue
    }
    const result =
      account.provider === "steam"
        ? await syncSteamAccount(supabase, account.userId, account.externalId, {
            refreshName: true,
          })
        : await syncLetterboxdAccount(supabase, account.userId, account.externalId)
    if (result.ok) summary.synced += 1
    else summary.failed += 1
  }

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } })
}
