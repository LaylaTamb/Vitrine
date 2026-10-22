"use client"

import { useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import { FolderOpen, GripVertical, Pencil, Trash2 } from "lucide-react"

import { VISIBILITY_ICONS } from "@/components/collection/privacy-switch"
import { FavoriteToggle } from "@/components/favorites/favorite-star"
import type { ViewMode } from "@/components/layout/view-toggle"
import { intoTargetId } from "@/lib/domain/drag"
import { visibilityLabel, type Visibility } from "@/lib/domain/privacy"
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
  /**
   * Pasta que recebe o que é arrastado para cima dela (soltar no miolo do card
   * põe dentro). Só vale dentro de um `DndContext`.
   */
  dropInto?: boolean
  onEdit?: () => void
  onDelete?: () => void
  /** A categoria tem a estrela (só o dono recebe). */
  favorite?: boolean
  /** Com ela, a estrela fica sempre à vista no card (só categoria, só o dono). */
  onToggleFavorite?: () => void
  /**
   * O nível, para o ícone ao lado do nome: cadeado na Privada, pessoas na de
   * Amigos, nada na Pública. Só o dono passa (e chega a ver).
   */
  visibility?: Visibility
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
  dropInto = false,
  onEdit,
  onDelete,
  favorite = false,
  onToggleFavorite,
  visibility = "public",
}: CollectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  })

  // O miolo do card (não a borda): a borda continua servindo para reordenar.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: intoTargetId(id),
    disabled: !dropInto,
  })

  const glyph = kind === "folder" ? "📁" : (icon ?? "")
  const isList = view === "list"

  const actions = canEdit ? (
    <div
      className={cn(
        // Em tela de toque (sem hover), à vista: senão ninguém acha editar e excluir.
        "card-actions absolute top-2 flex items-center gap-0.5 rounded-lg border border-line bg-surface-hi/90 p-0.5 backdrop-blur-sm [@media(hover:none)]:opacity-100",
        // As outras ações abrem ao lado da estrela, que fica sempre no canto.
        onToggleFavorite ? "right-11" : "right-2",
        // Na lista, no celular (sem hover), as ações nem entram na linha: o nome
        // ganha o espaço — como nas linhas de item.
        isList &&
          "relative right-auto top-auto hidden border-0 bg-transparent p-0 backdrop-blur-none sm:flex"
      )}
    >
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

  const star = onToggleFavorite ? (
    <FavoriteToggle
      active={favorite}
      name={name}
      onToggle={onToggleFavorite}
      className={cn("z-10 shrink-0", !isList && "absolute right-2 top-2")}
    />
  ) : null

  const handle = sortable ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${name}`}
      title="Arraste para reordenar ou para dentro de uma pasta"
      className={cn(
        // Em tela de toque a alça fica à vista: é por ela que se arrasta.
        "card-actions absolute left-1.5 top-2 cursor-grab touch-none rounded p-1 text-faint hover:text-foreground active:cursor-grabbing [@media(hover:none)]:opacity-100",
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
        <CardFace
          glyph={glyph}
          name={name}
          subtitle={subtitle}
          view={view}
          kind={kind}
          visibility={visibility}
        />
      </button>
    ) : (
      <Link href={href ?? "#"} className="flex min-w-0 flex-1 items-center gap-3 outline-none">
        <CardFace
          glyph={glyph}
          name={name}
          subtitle={subtitle}
          view={view}
          kind={kind}
          visibility={visibility}
        />
      </Link>
    )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/card vitrine-card relative",
        isList ? "flex items-center gap-2 px-3 py-2.5" : "p-4",
        isDragging && "z-10 border-line-hi opacity-90",
        isOver && "border-brand ring-2 ring-brand-dim"
      )}
    >
      {dropInto ? (
        <div ref={setDropRef} aria-hidden className="pointer-events-none absolute inset-[20%]" />
      ) : null}
      {isList ? (
        <>
          {handle}
          {body}
          {star}
          {actions}
        </>
      ) : (
        <>
          {handle}
          {star}
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
  visibility,
}: {
  glyph: string
  name: string
  subtitle: string
  view: ViewMode
  kind: "folder" | "category"
  visibility: Visibility
}) {
  const LevelIcon = VISIBILITY_ICONS[visibility]
  const label = visibilityLabel(kind, visibility)
  const lock =
    visibility === "public" ? null : (
      <LevelIcon role="img" aria-label={label} className="size-3.5 shrink-0 text-faint">
        <title>{label}</title>
      </LevelIcon>
    )

  if (view === "list") {
    return (
      <>
        <span className="flex size-8 shrink-0 items-center justify-center text-lg">
          {glyph || <FolderOpen className="size-4 text-faint" />}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="display block truncate text-base">{name}</span>
          {lock}
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
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="display block truncate text-lg leading-snug">{name}</span>
          {lock}
        </span>
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
