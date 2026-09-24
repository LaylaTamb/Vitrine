"use client"

import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"

import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { TagPill } from "@/components/tag/tag-pill"
import { Checkbox } from "@/components/ui/checkbox"
import type { EntryView } from "@/lib/domain/types"
import { categoryTintVars, cn } from "@/lib/utils"

/** O item no modo lista: miniatura 1:1, nome, resumo, tags e a nota à direita. */
export function EntryRow({
  view,
  canEdit,
  onEdit,
  onDelete,
  selectable,
  selecting,
  selected,
  onToggleSelect,
  categoryColor,
}: {
  view: EntryView
  canEdit: boolean
  onEdit?: () => void
  onDelete?: () => void
  selectable?: boolean
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (event: React.MouseEvent) => void
  categoryColor?: string | null
}) {
  return (
    <div
      className={cn(
        "group/card vitrine-card flex items-center gap-3 p-2",
        selected && "border-brand-dim bg-surface-hi"
      )}
      style={categoryTintVars(categoryColor)}
    >
      {selectable ? (
        <label
          className={cn("flex cursor-pointer items-center pl-1", !selecting && "card-actions")}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleSelect?.(event)
          }}
        >
          <Checkbox checked={selected} aria-label={`Selecionar ${view.name}`} />
        </label>
      ) : null}

      <Link
        href={view.href}
        onClick={(event) => {
          if (selecting) {
            event.preventDefault()
            onToggleSelect?.(event)
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none"
      >
        <EntryImage
          imageUrl={view.imageUrl}
          imageTransform={view.imageTransform}
          initial={view.initial}
          ratio="1 / 1"
          initialSize="1.25rem"
          className="w-12 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <h3 className="display truncate text-base leading-snug">{view.name}</h3>
          {view.summary ? (
            <p className="truncate text-xs text-muted-foreground">{view.summary}</p>
          ) : null}
        </div>

        {view.tags.length > 0 ? (
          <div className="hidden shrink-0 gap-1 sm:flex">
            {view.tags.slice(0, 2).map((tag) => (
              <TagPill key={tag.id} tag={tag} size="xs" />
            ))}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          <Stars percent={view.ratingPercent} size="sm" />
          <span
            className={cn(
              "display w-8 text-right text-sm",
              view.hasRating ? "text-foreground" : "text-faint"
            )}
          >
            {view.ratingLabel}
          </span>
        </div>
      </Link>

      {canEdit ? (
        <div className="card-actions flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title={`Editar ${view.name}`}
            aria-label={`Editar ${view.name}`}
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            title={`Excluir ${view.name}`}
            aria-label={`Excluir ${view.name}`}
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
