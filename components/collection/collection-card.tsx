"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import { FolderOpen, GripVertical, MoveRight, Pencil, Trash2 } from "lucide-react"

import type { ViewMode } from "@/components/layout/view-toggle"
import { cn } from "@/lib/utils"

export interface CollectionCardProps {
  id: string
  kind: "folder" | "category"
  name: string
  icon: string | null
  subtitle: string
  href?: string
  onOpen?: () => void
  canEdit: boolean
  sortable: boolean
  view: ViewMode
  onMove?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function CollectionCard({
  id,
  kind,
  name,
  icon,
  subtitle,
  href,
  onOpen,
  canEdit,
  sortable,
  view,
  onMove,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  })

  const glyph = kind === "folder" ? "📁" : (icon ?? "")
  const isList = view === "list"

  const actions = canEdit ? (
    <div
      className={cn(
        "card-actions absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-line bg-surface-hi/90 p-0.5 backdrop-blur-sm",
        isList && "relative right-auto top-auto border-0 bg-transparent p-0 backdrop-blur-none"
      )}
    >
      {onMove ? (
        <IconButton label={`Mover ${name}`} onClick={onMove}>
          <MoveRight className="size-3.5" />
        </IconButton>
      ) : null}
      {onEdit ? (
        <IconButton label={`Editar ${name}`} onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
      ) : null}
      {onDelete ? (
        <IconButton label={`Excluir ${name}`} onClick={onDelete} danger>
          <Trash2 className="size-3.5" />
        </IconButton>
      ) : null}
    </div>
  ) : null

  const handle = sortable ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Reordenar ${name}`}
      className={cn(
        "card-actions absolute left-1.5 top-2 cursor-grab touch-none rounded p-1 text-faint hover:text-foreground active:cursor-grabbing",
        isList && "relative left-auto top-auto"
      )}
    >
      <GripVertical className="size-4" />
    </button>
  ) : null

  const body =
    kind === "folder" ? (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
      >
        <CardFace glyph={glyph} name={name} subtitle={subtitle} view={view} kind={kind} />
      </button>
    ) : (
      <Link href={href ?? "#"} className="flex min-w-0 flex-1 items-center gap-3 outline-none">
        <CardFace glyph={glyph} name={name} subtitle={subtitle} view={view} kind={kind} />
      </Link>
    )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/card vitrine-card relative",
        isList ? "flex items-center gap-2 px-3 py-2.5" : "p-4",
        isDragging && "z-10 border-line-hi opacity-90"
      )}
    >
      {isList ? (
        <>
          {handle}
          {body}
          {actions}
        </>
      ) : (
        <>
          {handle}
          {actions}
          {body}
        </>
      )}
    </div>
  )
}

function CardFace({
  glyph,
  name,
  subtitle,
  view,
  kind,
}: {
  glyph: string
  name: string
  subtitle: string
  view: ViewMode
  kind: "folder" | "category"
}) {
  if (view === "list") {
    return (
      <>
        <span className="flex size-8 shrink-0 items-center justify-center text-lg">
          {glyph || <FolderOpen className="size-4 text-faint" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="display block truncate text-base">{name}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{subtitle}</span>
      </>
    )
  }

  return (
    <span className="flex min-w-0 flex-col gap-2 pt-4">
      <span className="text-2xl leading-none">
        {glyph || <span className="text-faint">{kind === "folder" ? "📁" : "▫"}</span>}
      </span>
      <span className="min-w-0">
        <span className="display block truncate text-lg leading-snug">{name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </span>
  )
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground",
        danger && "hover:text-danger"
      )}
    >
      {children}
    </button>
  )
}
