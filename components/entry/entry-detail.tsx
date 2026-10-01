import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { EntryDetailActions } from "@/components/entry/entry-detail-actions"
import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { TagPill } from "@/components/tag/tag-pill"
import { formatRating } from "@/lib/domain/format"
import type { Category, EntryFolder, EntryView, Profile, Tag } from "@/lib/domain/types"
import { withFolder } from "@/lib/navigation"

/**
 * A plaqueta completa do item. Sem estado e sem hook: a página do app
 * (Server Component) e a da demonstração (cliente) usam a mesma.
 *
 * O "voltar" sobe um nível: para a subpasta onde o item está, ou para a raiz
 * da categoria.
 */
export function EntryDetail({
  view,
  category,
  owner,
  tags,
  entryFolders,
  canEdit,
  basePath = "",
}: {
  view: EntryView
  category: Category
  /** Sem dono (demonstração): some o link "acervo de …". */
  owner: Profile | null
  tags: Tag[]
  entryFolders: EntryFolder[]
  canEdit: boolean
  basePath?: string
}) {
  const folder = entryFolders.find((item) => item.id === view.folderId) ?? null
  const backHref = withFolder(`${basePath}/categoria/${category.id}`, folder?.id ?? null)
  const backLabel = folder
    ? `📁 ${folder.name}`
    : `${category.icon ? `${category.icon} ` : ""}${category.name}`
  const ownerName = owner?.display_name || owner?.username || "alguém"

  return (
    <div className="grid gap-8 py-8 md:grid-cols-[2fr_3fr]">
      <div>
        <EntryImage
          imageUrl={view.imageUrl}
          imageTransform={view.imageTransform}
          initial={view.initial}
          initialSize="6rem"
          eager
          tint={category.color}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            voltar para {backLabel}
          </Link>

          {owner ? (
            <Link href={`/u/${owner.username}`} className="plaque block hover:text-foreground">
              acervo de {ownerName}
            </Link>
          ) : null}
        </div>

        <h1 className="display text-[2.3rem] leading-tight break-words">{view.name}</h1>

        {category.rating_enabled ? (
          <div className="flex items-center gap-2">
            <Stars percent={view.ratingPercent} size="md" />
            <span className="text-sm text-muted-foreground">
              {view.hasRating ? `${formatRating(view.rating)} de 5` : "sem avaliação"}
            </span>
          </div>
        ) : null}

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
            categoryId={category.id}
            estrutura={category.estrutura}
            tags={tags}
            folders={entryFolders}
            ratingEnabled={category.rating_enabled}
          />
        ) : null}
      </div>
    </div>
  )
}
