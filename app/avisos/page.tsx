import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { NoticesView } from "@/components/social/notices-view"
import { matchState } from "@/lib/domain/match"
import { getMyMatches } from "@/lib/queries/matches"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyFollows, getNotifications } from "@/lib/queries/social"

export const metadata: Metadata = { title: "Avisos · Vitrine" }

/**
 * `/avisos` — os avisos (migração 21), com a ação no próprio aviso: quem você
 * ainda não segue ganha o "Seguir de volta"; o convite que espera a sua
 * resposta, o "Aceitar". O sininho da barra traz para cá.
 */
export default async function NoticesPage() {
  const user = await requireUser()
  const [profile, items, mine, { matches }] = await Promise.all([
    getMyProfile(),
    getNotifications(),
    getMyFollows(user.id),
    getMyMatches(user.id),
  ])
  const pendingInvites = matches
    .filter((match) => matchState(match, user.id) === "answer")
    .map((match) => match.id)

  return (
    <AppShell profile={profile}>
      <PageHeader title="Avisos" />
      <NoticesView
        items={items}
        following={[...mine.following]}
        pendingInvites={pendingInvites}
        now={new Date().toISOString()}
      />
    </AppShell>
  )
}
