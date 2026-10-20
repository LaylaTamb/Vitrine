import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { MatchesView } from "@/components/match/matches-view"
import { MATCHES_NOT_READY } from "@/lib/domain/match"
import { getMyFriends, getMyMatches } from "@/lib/queries/matches"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Matches · Vitrine" }

/**
 * `/matches` — os convites e os matches de quem está logado (migração 30), e
 * o "Novo match" (só com amigos, até 8 pessoas).
 */
export default async function MatchesPage() {
  const user = await requireUser()
  const [profile, { ready, matches }, friends] = await Promise.all([
    getMyProfile(),
    getMyMatches(),
    getMyFriends(user.id),
  ])

  return (
    <AppShell profile={profile}>
      <MatchesView
        meId={user.id}
        matches={matches}
        friends={friends}
        notReady={ready ? null : MATCHES_NOT_READY}
      />
    </AppShell>
  )
}
