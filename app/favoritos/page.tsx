import type { Metadata } from "next"

import { FavoritesView } from "@/components/favorites/favorites-view"
import { AppShell } from "@/components/layout/app-shell"
import { getFavoritesPage } from "@/lib/queries/favorites"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Favoritos · Vitrine" }

/**
 * `/favoritos` — o favorito de cada categoria que a pessoa pôs na aba, na
 * ordem dela. Só ela vê (a tabela tem RLS só do dono).
 */
export default async function FavoritesPage() {
  const user = await requireUser()
  const [data, profile] = await Promise.all([getFavoritesPage(user.id), getMyProfile()])

  return (
    <AppShell profile={profile}>
      <FavoritesView
        ready={data.ready}
        rows={data.rows}
        categories={data.categories}
        entries={data.entries}
        tags={data.tags}
      />
    </AppShell>
  )
}
