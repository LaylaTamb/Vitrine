import type { Metadata } from "next"

import { GlobalFilterView } from "@/components/filter/global-filter-view"
import { AppShell } from "@/components/layout/app-shell"
import type { EntryView, Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { getAcervo } from "@/lib/queries/acervo"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Filtro geral · Vitrine" }

/** `/filtro` — cruza todas as categorias do usuário logado. */
export default async function FilterPage() {
  const user = await requireUser()

  const [{ categories, entriesByCategory, tags }, profile] = await Promise.all([
    getAcervo(user.id),
    getMyProfile(),
  ])

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const views: EntryView[] = []
  for (const category of categories) {
    for (const entry of entriesByCategory.get(category.id) ?? []) {
      views.push(toView(entry, category.estrutura, tagsById, category.name))
    }
  }

  return (
    <AppShell profile={profile}>
      <GlobalFilterView categories={categories} views={views} tags={tags} />
    </AppShell>
  )
}
