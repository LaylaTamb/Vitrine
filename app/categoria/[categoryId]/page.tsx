import type { Metadata } from "next"
import { Library } from "lucide-react"

import { CategoryView } from "@/components/category/category-view"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { categoryFilterFromParams } from "@/lib/domain/filter"
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
  modo?: string
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

  const [
    { category, owner, siblings, entries, tags, entryFolders, collectionFolders },
    profile,
    query,
  ] = await Promise.all([
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

  const initialFilter = categoryFilterFromParams(query)

  const canEdit = category.owner_id === user.id
  // O Voltar da raiz da categoria leva às Coleções de quem é dono dela.
  const collectionsHref = canEdit || !owner ? "/" : `/u/${owner.username}`

  return (
    <AppShell profile={profile}>
      <CategoryView
        category={category}
        owner={owner}
        siblings={siblings}
        views={views}
        tags={tags}
        entryFolders={entryFolders}
        collectionFolders={collectionFolders}
        collectionsHref={collectionsHref}
        canEdit={canEdit}
        initialFilter={initialFilter}
        initialTab={query.aba === "numeros" ? "numeros" : "itens"}
      />
    </AppShell>
  )
}
