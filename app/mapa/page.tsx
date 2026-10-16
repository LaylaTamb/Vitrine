import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { MapView, type MapTab } from "@/components/map/map-view"
import type { EntryView, Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { getAcervo } from "@/lib/queries/acervo"
import { getMyPlaces } from "@/lib/queries/places"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Mapa · Vitrine" }

type SearchParams = Promise<{ item?: string; aba?: string; categoria?: string }>

/**
 * `/mapa` — tudo que eu marquei com Localização, com o mesmo filtro do
 * Filtro geral. Só do dono: a tela de outra pessoa (`/u/...`) e a
 * demonstração não têm mapa.
 *
 * O acervo, o perfil e a localização dos itens vêm juntos; o mapa
 * (MapLibre + OpenFreeMap) só carrega no navegador, e só nesta página.
 */
export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()

  const [{ categories, entriesByCategory, tags }, profile, { places, ready }, query] =
    await Promise.all([getAcervo(user.id), getMyProfile(), getMyPlaces(user.id), searchParams])

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const views: EntryView[] = []
  for (const category of categories) {
    for (const entry of entriesByCategory.get(category.id) ?? []) {
      views.push(toView(entry, category.estrutura, tagsById, category.name))
    }
  }

  const initialTab: MapTab = query.aba === "sugestoes" ? "sugestoes" : "mapa"

  return (
    <AppShell profile={profile}>
      <MapView
        categories={categories}
        views={views}
        tags={tags}
        places={places}
        placesReady={ready}
        initialTab={initialTab}
        focusEntryId={query.item ?? null}
        initialCategoryId={query.categoria ?? null}
      />
    </AppShell>
  )
}
