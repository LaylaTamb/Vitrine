import type { Metadata } from "next"

import { ExploreView } from "@/components/explore/explore-view"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { EXPLORE_NOT_READY } from "@/lib/domain/explore"
import { getExplore } from "@/lib/queries/explore"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Explorar · Vitrine" }

/**
 * `/explorar` — categorias públicas de outras pessoas, com itens. "Pegar com
 * itens" faz uma cópia sua que continua ligada à original (migração 26).
 */
export default async function ExplorePage() {
  await requireUser()
  const [profile, explore] = await Promise.all([getMyProfile(), getExplore()])

  return (
    <AppShell profile={profile}>
      <PageHeader
        label="Descobrir"
        title="Explorar"
        subtitle="Categorias públicas de outras pessoas. Pegue com os itens: a sua cópia continua recebendo as novidades de quem fez."
      />
      <ExploreView
        initial={explore.results}
        notReady={explore.ready ? explore.error : EXPLORE_NOT_READY}
      />
    </AppShell>
  )
}
