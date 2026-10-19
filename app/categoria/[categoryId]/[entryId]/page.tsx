import type { Metadata } from "next"
import { ImageOff } from "lucide-react"

import { EntryDetail } from "@/components/entry/entry-detail"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import type { Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { getEntryPage } from "@/lib/queries/entry"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>
}): Promise<Metadata> {
  const { entryId } = await params
  const { entry } = await getEntryPage(entryId)
  return { title: entry ? `${entry.name} · Vitrine` : "Vitrine" }
}

/** `/categoria/[id]/[entryId]` — a plaqueta completa do item. */
export default async function EntryPage({
  params,
}: {
  params: Promise<{ categoryId: string; entryId: string }>
}) {
  const { entryId } = await params
  const user = await requireUser()

  const [{ entry, category, owner, tags, entryFolders, places }, profile] = await Promise.all([
    getEntryPage(entryId),
    getMyProfile(),
  ])

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
      />
    </AppShell>
  )
}
