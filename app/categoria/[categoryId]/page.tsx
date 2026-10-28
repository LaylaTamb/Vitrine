import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Library } from "lucide-react"

import { CategoryView } from "@/components/category/category-view"
import type { LinkView } from "@/components/explore/linked-bar"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { linkChanged, linkNews } from "@/lib/domain/explore"
import { categoryFilterFromParams } from "@/lib/domain/filter"
import { isMatchCategory } from "@/lib/domain/match"
import type { Tag } from "@/lib/domain/types"
import { profilePath } from "@/lib/domain/username"
import { toView } from "@/lib/domain/view"
import { getCategoryPage, loadCategoryPage } from "@/lib/queries/category"
import { getCategorySync } from "@/lib/queries/connected"
import { syncLinkedCategory } from "@/lib/queries/explore"
import { getPublicCategory } from "@/lib/queries/public"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"

type SearchParams = Promise<{
  q?: string
  min?: string
  max?: string
  tags?: string
  ordem?: string
  aba?: string
  modo?: string
  /** O item que acabou de trocar de categoria: abre já em edição. */
  editar?: string
}>

type Params = Promise<{ categoryId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categoryId } = await params
  const user = await getSessionUser()
  const category = user
    ? (await getCategoryPage(categoryId)).category
    : ((await getPublicCategory(categoryId))?.category ?? null)
  return { title: category ? `${category.name} · Vitrine` : "Vitrine" }
}

/**
 * `/categoria/[id]` — Itens e Números.
 *
 * Uma consulta com embedding traz categoria + dono + irmãs + itens + vínculos
 * de tag; as tags do grupo vão em paralelo. A categoria inteira desce de uma
 * vez, e o filtro roda na memória do cliente daí em diante.
 *
 * Sem login, a mesma tela abre em modo visitante (somente leitura), mas só se
 * a categoria for pública — pela função `public_category`.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { categoryId } = await params
  const user = await getSessionUser()
  if (!user) return <VisitorCategoryPage categoryId={categoryId} searchParams={searchParams} />

  // Junto, sem ida a mais: é a categoria da Steam ou do Letterboxd? (só a do
  // próprio dono volta — a RLS esconde o resto.)
  const [firstRead, profile, query, connected] = await Promise.all([
    getCategoryPage(categoryId),
    getMyProfile(),
    searchParams,
    getCategorySync(user.id, categoryId),
  ])

  // Cópia do Explorar ainda ligada: traz as novidades da original antes de
  // mostrar (o banco só trabalha se a última vez foi há mais de 10 minutos).
  // Mudou algo? Lê de novo — a leitura de cima é a de antes.
  let data = firstRead
  let link: LinkView | null = null
  if (firstRead.category?.linked && firstRead.category.owner_id === user.id) {
    const sync = await syncLinkedCategory(categoryId)
    if (linkChanged(sync)) data = await loadCategoryPage(categoryId)
    if (sync.status === "unlinked") link = { status: "unlinked", author: null, news: null }
    else if (sync.status !== "not_linked") {
      link = { status: "linked", author: sync.author, news: linkNews(sync) }
    }
  }
  const {
    category,
    owner,
    siblings,
    entries,
    tags,
    entryFolders,
    collectionFolders,
    isFavorite,
  } = data

  if (!category) {
    return (
      <AppShell profile={profile}>
        <div className="py-16">
          <EmptyState
            icon={Library}
            title="Categoria não encontrada"
            description="Ela pode ter sido excluída ou ficado privada — ou o endereço está errado."
          />
        </div>
      </AppShell>
    )
  }

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const views = entries.map((entry) => toView(entry, category.estrutura, tagsById, category.name))

  // Sem `ordem` na URL, a categoria abre na ordenação padrão dela.
  const initialFilter = categoryFilterFromParams(query, category)

  const canEdit = category.owner_id === user.id

  // Uma cópia antiga de match (SQL 31): o match agora mora na aba Match.
  if (isMatchCategory(category)) {
    redirect(category.match_id ? `/matches/${category.match_id}` : "/matches")
  }
  // O Voltar da raiz da categoria leva às Coleções de quem é dono dela (no perfil).
  const collectionsHref = owner ? profilePath(owner.username) : "/perfil"

  return (
    <AppShell profile={profile}>
      <CategoryView
        key={category.id}
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
        initialEditId={query.editar ?? null}
        isFavorite={canEdit && isFavorite}
        link={canEdit ? link : null}
        // Passou 1 hora: a tela busca as novidades depois de pintar.
        autoRefresh={canEdit && connected?.due ? connected.provider : null}
      />
    </AppShell>
  )
}

/** Quem não tem conta: só categoria pública, sem nenhum botão de editar. */
async function VisitorCategoryPage({
  categoryId,
  searchParams,
}: {
  categoryId: string
  searchParams: SearchParams
}) {
  const [data, query] = await Promise.all([getPublicCategory(categoryId), searchParams])
  const next = `/categoria/${categoryId}`

  if (!data) {
    return (
      <AppShell profile={null} visitor={{ next }}>
        <div className="py-16">
          <EmptyState
            icon={Library}
            title="Categoria não encontrada"
            description="Ela pode não ser pública. Se alguém compartilhou com você, entre na sua conta para ver."
            action={
              <Link
                href={`/login?proximo=${encodeURIComponent(next)}`}
                className={buttonVariants()}
              >
                Entrar
              </Link>
            }
          />
        </div>
      </AppShell>
    )
  }

  const { owner, category, entryFolders, entries, tags } = data
  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const views = entries.map((entry) => toView(entry, category.estrutura, tagsById, category.name))

  return (
    <AppShell profile={null} visitor={{ next }}>
      <CategoryView
        category={category}
        owner={owner}
        siblings={[]}
        views={views}
        tags={tags}
        entryFolders={entryFolders}
        // As pastas das Coleções não vêm: a trilha começa nas Coleções do dono.
        collectionFolders={[]}
        collectionsHref={profilePath(owner.username)}
        canEdit={false}
        initialFilter={categoryFilterFromParams(query, category)}
        initialTab={query.aba === "numeros" ? "numeros" : "itens"}
      />
    </AppShell>
  )
}
