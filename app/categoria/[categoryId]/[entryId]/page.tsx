import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ImageOff } from "lucide-react"

import { EntryDetailActions } from "@/components/entry/entry-detail-actions"
import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { TagPill } from "@/components/tag/tag-pill"
import { formatRating } from "@/lib/domain/format"
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
  const { categoryId, entryId } = await params
  const user = await requireUser()

  const [{ entry, category, owner, tags }, profile] = await Promise.all([
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
            description="Ele pode ter sido excluído, ou o endereço está errado."
          />
        </div>
      </AppShell>
    )
  }

  const tagsById = new Map<string, Tag>(tags.map((tag) => [tag.id, tag]))
  const view = toView(entry, category.estrutura, tagsById, category.name)
  const canEdit = entry.owner_id === user.id
  const ownerName = owner?.display_name || owner?.username || "alguém"

  return (
    <AppShell profile={profile}>
      <div className="grid gap-8 py-8 md:grid-cols-[2fr_3fr]">
        <div>
          <EntryImage
            imageUrl={view.imageUrl}
            imagePosition={view.imagePosition}
            imageTransform={view.imageTransform}
            initial={view.initial}
            initialSize="6rem"
            eager
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Link
              href={`/categoria/${categoryId}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              voltar para {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </Link>

            {owner ? (
              <Link href={`/u/${owner.username}`} className="plaque block hover:text-foreground">
                acervo de {ownerName}
              </Link>
            ) : null}
          </div>

          <h1 className="display text-[2.3rem] leading-tight break-words">{view.name}</h1>

          <div className="flex items-center gap-2">
            <Stars percent={view.ratingPercent} size="md" />
            <span className="text-sm text-muted-foreground">
              {view.hasRating ? `${formatRating(view.rating)} de 5` : "sem avaliação"}
            </span>
          </div>

          {view.extras.length > 0 ? (
            <dl className="pt-2">
              {view.extras.map((extra) => (
                <div
                  key={extra.id}
                  className="flex flex-col gap-0.5 border-b border-line py-2.5 sm:flex-row sm:gap-4"
                >
                  <dt className="plaque w-40 shrink-0 pt-0.5">{extra.label}</dt>
                  <dd className="min-w-0 flex-1 text-sm break-words">
                    {extra.isStar ? (
                      <span className="flex items-center gap-2">
                        <Stars percent={extra.percent} size="sm" />
                        <span>{extra.value}</span>
                      </span>
                    ) : (
                      extra.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {view.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {view.tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} />
              ))}
            </div>
          ) : null}

          {canEdit ? (
            <EntryDetailActions
              view={view}
              categoryId={categoryId}
              estrutura={category.estrutura}
              tags={tags}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
