import type { Metadata } from "next"
import Link from "next/link"
import { ImageOff } from "lucide-react"

import { EntryDetail } from "@/components/entry/entry-detail"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { isMatchCategory, matchOrigin } from "@/lib/domain/match"
import type { Tag } from "@/lib/domain/types"
import { formatFieldValue, toView } from "@/lib/domain/view"
import { getEntryPage } from "@/lib/queries/entry"
import { getMatchCopy } from "@/lib/queries/matches"
import { getPublicCategory } from "@/lib/queries/public"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"

type Params = Promise<{ categoryId: string; entryId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categoryId, entryId } = await params
  const user = await getSessionUser()
  const name = user
    ? (await getEntryPage(entryId)).entry?.name
    : (await getPublicCategory(categoryId))?.entries.find((entry) => entry.id === entryId)?.name
  return { title: name ? `${name} · Vitrine` : "Vitrine" }
}

/**
 * `/categoria/[id]/[entryId]` — a plaqueta completa do item.
 *
 * Sem login, abre em modo visitante se a categoria for pública (o item vem
 * junto da categoria, pela função `public_category`).
 */
export default async function EntryPage({ params }: { params: Params }) {
  const { categoryId, entryId } = await params
  const user = await getSessionUser()
  if (!user) return <VisitorEntryPage categoryId={categoryId} entryId={entryId} />

  const [{ entry, category, owner, categories, tags, entryFolders, places }, profile] =
    await Promise.all([getEntryPage(entryId), getMyProfile()])

  if (!entry || !category) {
    return (
      <AppShell profile={profile}>
        <div className="py-16">
          <EmptyState
            icon={ImageOff}
            title="Item não encontrado"
            description="Ele pode ter sido excluído, a categoria dele pode ter ficado privada — ou o endereço está errado."
          />
        </div>
      </AppShell>
    )
  }

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const view = toView(entry, category.estrutura, tagsById, category.name)
  const isOwner = entry.owner_id === user.id

  // Item da cópia de um match: as marcações dependem da cópia inteira.
  let match = null
  if (isOwner && isMatchCategory(category)) {
    const { byEntry } = await getMatchCopy(category, user.id)
    const entryMatch = byEntry.get(entry.id)
    if (entryMatch) {
      view.match = entryMatch
      match = { entry: entryMatch, origin: matchOrigin(entry.match_fields, formatFieldValue) }
    }
  }

  return (
    <AppShell profile={profile}>
      <EntryDetail
        view={view}
        category={category}
        owner={owner}
        tags={tags}
        entryFolders={entryFolders}
        canEdit={isOwner}
        places={places}
        // O Mapa só mostra os itens de quem está logado.
        showMapLink={isOwner}
        categories={isOwner ? categories : []}
        match={match}
      />
    </AppShell>
  )
}

/** Quem não tem conta: só item de categoria pública, somente leitura. */
async function VisitorEntryPage({ categoryId, entryId }: { categoryId: string; entryId: string }) {
  const data = await getPublicCategory(categoryId)
  const entry = data?.entries.find((item) => item.id === entryId) ?? null
  const next = `/categoria/${categoryId}/${entryId}`

  if (!data || !entry) {
    return (
      <AppShell profile={null} visitor={{ next }}>
        <div className="py-16">
          <EmptyState
            icon={ImageOff}
            title="Item não encontrado"
            description="A categoria dele pode não ser pública. Se alguém compartilhou com você, entre na sua conta para ver."
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

  const tagsById = new Map<string, Tag>(data.tags.map((tag) => [tag.id, tag]))
  const view = toView(entry, data.category.estrutura, tagsById, data.category.name)

  return (
    <AppShell profile={null} visitor={{ next }}>
      {/* Sem `places`: o "Abrir no Maps" usa o texto do endereço. */}
      <EntryDetail
        view={view}
        category={data.category}
        owner={data.owner}
        tags={data.tags}
        entryFolders={data.entryFolders}
        canEdit={false}
      />
    </AppShell>
  )
}
