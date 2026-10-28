import type { Metadata } from "next"

import { ExploreView } from "@/components/explore/explore-view"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { EXPLORE_NOT_READY } from "@/lib/domain/explore"
import { getCoversOf, getExplore } from "@/lib/queries/explore"
import { listProfiles } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyFollows } from "@/lib/queries/social"

export const metadata: Metadata = { title: "Descobrir · Vitrine" }

/**
 * `/explorar` — o Descobrir: pessoas para seguir (a antiga Pessoas) e as
 * categorias públicas de outras pessoas, com itens. "Pegar com itens" faz uma
 * cópia sua que continua ligada à original (migração 26).
 */
export default async function ExplorePage() {
  const user = await requireUser()
  const [profile, explore, profiles, mine] = await Promise.all([
    getMyProfile(),
    getExplore(),
    listProfiles(),
    getMyFollows(user.id),
  ])
  // Precisa dos ids da primeira lista: é a segunda ida.
  const covers = await getCoversOf(explore.results.map((category) => category.id))

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Descobrir"
        subtitle="Pessoas e categorias de quem cataloga como você. Pegue uma categoria com os itens: a sua cópia continua recebendo as novidades de quem fez."
      />
      <ExploreView
        initial={explore.results}
        initialCovers={covers}
        notReady={explore.ready ? explore.error : EXPLORE_NOT_READY}
        people={profiles.filter((item) => item.id !== user.id)}
        following={[...mine.following]}
        followers={[...mine.followers]}
      />
    </AppShell>
  )
}
