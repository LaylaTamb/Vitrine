import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { BlendView } from "@/components/match/blend-view"
import {
  BLEND_NOT_READY,
  blendDay,
  blendHighlights,
  blendTaste,
  buildBlend,
} from "@/lib/domain/blend"
import { getBroughtIds, getMatchBlendPool, getMatchById } from "@/lib/queries/matches"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Match · Vitrine" }

/**
 * `/matches/[id]` — a lista do match no modelo do Blend (migração 45): a
 * mesma para todo mundo do match, a de hoje (muda à meia-noite de São Paulo),
 * com a % e o porquê. Só quem está no match abre (a RLS).
 */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const [profile, match] = await Promise.all([getMyProfile(), getMatchById(id)])
  if (!match) notFound()

  const { ready, pool } =
    match.status === "ready" ? await getMatchBlendPool(match.id) : { ready: true, pool: null }
  const now = new Date()
  const memberIds = match.members.map((member) => member.userId)
  const picks = pool
    ? buildBlend({ pool, memberIds, seed: `${match.id}:${blendDay(now)}`, now })
    : []
  const brought = await getBroughtIds(
    user.id,
    picks.flatMap((pick) => pick.owners.map((owner) => owner.entryId))
  )

  return (
    <AppShell profile={profile}>
      <BlendView
        meId={user.id}
        match={match}
        picks={picks}
        taste={pool ? blendTaste(pool, memberIds) : null}
        highlights={pool ? blendHighlights(pool) : null}
        brought={brought}
        notReady={ready ? null : BLEND_NOT_READY}
      />
    </AppShell>
  )
}
