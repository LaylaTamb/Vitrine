import type { Metadata } from "next"

import { FavoritesView } from "@/components/favorites/favorites-view"
import { AppShell } from "@/components/layout/app-shell"
import { getFavoritesPage } from "@/lib/queries/favorites"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Favoritos · Vitrine" }

/**
 * `/favoritos` — a estrela no canto das Coleções: só as categorias marcadas
 * com a estrela, na ordem da pessoa, sem tirá-las das pastas. Só ela vê (a
 * tabela tem RLS só do dono).
 */
export default async function FavoritesPage() {
  const user = await requireUser()
  const [data, profile] = await Promise.all([getFavoritesPage(user.id), getMyProfile()])

  return (
    <AppShell profile={profile}>
      <FavoritesView
        ready={data.ready}
        order={data.order}
        categories={data.categories}
        folders={data.folders}
        counts={data.counts}
      />
    </AppShell>
  )
}
