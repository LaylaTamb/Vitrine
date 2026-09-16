import type { Metadata } from "next"
import { Library } from "lucide-react"

import { CategoryView } from "@/components/category/category-view"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { EMPTY_CATEGORY_FILTER, type CategoryFilter, type SortKey } from "@/lib/domain/filter"
import type { Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { getCategoryPage } from "@/lib/queries/category"
import { getMyProfile, requireUser } from "@/lib/queries/session"

type SearchParams = Promise<{
  q?: string
  min?: string
  max?: string
  tags?: string
  ordem?: string
  aba?: string
}>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoryId: string }>
}): Promise<Metadata> {
  const { categoryId } = await params
  const { category } = await getCategoryPage(categoryId)
  return { title: category ? `${category.name} · Vitrine` : "Vitrine" }
}

const SORTS: SortKey[] = ["recent", "rating_desc", "rating_asc", "name_asc"]

/**
 * `/categoria/[id]` — Itens e Números.
 *
 * Uma consulta com embedding traz categoria + dono + irmãs + itens + vínculos
 * de tag; as tags do grupo vão em paralelo. A categoria inteira desce de uma
 * vez, e o filtro roda na memória do cliente daí em diante.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>
  searchParams: SearchParams
}) {
  const { categoryId } = await params
  const user = await requireUser()

  const [{ category, owner, siblings, entries, tags }, profile, query] = await Promise.all([
    getCategoryPage(categoryId),
    getMyProfile(),
    searchParams,
  ])

  if (!category) {
    return (
      <AppShell profile={profile}>
        <div className="py-16">
          <EmptyState
            icon={Library}
            title="Categoria não encontrada"
            description="Ela pode ter sido excluída, ou o endereço está errado."
          />
        </div>
      </AppShell>
    )
  }

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const views = entries.map((entry) => toView(entry, category.estrutura, tagsById, category.name))

  const sort = SORTS.find((item) => item === query.ordem) ?? "recent"
  const initialFilter: CategoryFilter = {
    ...EMPTY_CATEGORY_FILTER,
    query: query.q ?? "",
    minRating: query.min ?? "",
    maxRating: query.max ?? "",
    tagIds: (query.tags ?? "").split(",").filter(Boolean),
    sort,
  }

  return (
    <AppShell profile={profile}>
      <CategoryView
        category={category}
        owner={owner}
        siblings={siblings}
        views={views}
        tags={tags}
        canEdit={category.owner_id === user.id}
        initialFilter={initialFilter}
        initialTab={query.aba === "numeros" ? "numeros" : "itens"}
      />
    </AppShell>
  )
}
