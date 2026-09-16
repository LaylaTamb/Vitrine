"use client"

import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"

import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { TagPill } from "@/components/tag/tag-pill"
import { Checkbox } from "@/components/ui/checkbox"
import type { EntryView } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function EntryCard({
  view,
  canEdit,
  onEdit,
  onDelete,
  selectable,
  selecting,
  selected,
  onToggleSelect,
}: {
  view: EntryView
  canEdit: boolean
  onEdit?: () => void
  onDelete?: () => void
  selectable?: boolean
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (event: React.MouseEvent) => void
}) {
  return (
    <div
      className={cn(
        "group/card vitrine-card relative p-2",
        selected && "border-brand-dim bg-surface-hi"
      )}
    >
      {selectable ? (
        <label
          className={cn(
            "absolute left-3 top-3 z-20 flex size-6 cursor-pointer items-center justify-center rounded-md border border-line bg-bg/80 backdrop-blur-sm",
            !selecting && "card-actions"
          )}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleSelect?.(event)
          }}
        >
          <Checkbox checked={selected} aria-label={`Selecionar ${view.name}`} />
        </label>
      ) : null}

      {canEdit ? (
        <div className="card-actions absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-lg border border-line bg-bg/80 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            title={`Editar ${view.name}`}
            aria-label={`Editar ${view.name}`}
            onClick={(event) => {
              event.preventDefault()
              onEdit?.()
            }}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            title={`Excluir ${view.name}`}
            aria-label={`Excluir ${view.name}`}
            onClick={(event) => {
              event.preventDefault()
              onDelete?.()
            }}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}

      <Link
        href={view.href}
        onClick={(event) => {
          // Em modo seleção, clicar no card marca em vez de navegar.
          if (selecting) {
            event.preventDefault()
            onToggleSelect?.(event)
          }
        }}
        className="block outline-none"
      >
        <div className="relative">
          <EntryImage
            imageUrl={view.imageUrl}
            imagePosition={view.imagePosition}
            imageTransform={view.imageTransform}
            initial={view.initial}
          />

          {view.hasRating ? (
            <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-md border border-line bg-bg/85 px-1.5 py-1 backdrop-blur-sm">
              <span className="display text-sm leading-none text-foreground">
                {view.ratingLabel}
              </span>
              <Stars percent={view.ratingPercent} size="sm" />
            </span>
          ) : null}
        </div>

        <div className="space-y-1 px-1 pb-1 pt-2.5">
          <h3 className="display truncate text-base leading-snug">{view.name}</h3>
          {view.summary ? (
            <p className="truncate text-xs text-muted-foreground">{view.summary}</p>
          ) : null}
          {view.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {view.tags.slice(0, 3).map((tag) => (
                <TagPill key={tag.id} tag={tag} size="xs" />
              ))}
              {view.tags.length > 3 ? (
                <span className="text-[0.65rem] text-faint">+{view.tags.length - 3}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  )
}
