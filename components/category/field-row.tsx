"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, X } from "lucide-react"

import { FIELD_TYPE_LABELS } from "@/lib/domain/fields"
import type { FieldDef } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** Uma linha do editor de estrutura, arrastável. */
export function FieldRow({
  field,
  editing = false,
  onEdit,
  onRemove,
}: {
  field: FieldDef
  /** Está sendo editada agora (destacada, remover desabilitado). */
  editing?: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-2 py-2",
        isDragging && "z-10 border-line-hi opacity-90",
        editing && "border-brand-dim bg-brand-wash"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-faint hover:text-foreground active:cursor-grabbing"
        aria-label={`Reordenar ${field.nome}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{field.nome}</p>
        {field.tipo === "select" && field.opcoes?.length ? (
          <p className="truncate text-xs text-faint">{field.opcoes.join(" · ")}</p>
        ) : field.tipo === "currency" ? (
          <p className="truncate text-xs text-faint">{field.moeda}</p>
        ) : null}
      </div>

      <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.68rem] text-muted-foreground">
        {FIELD_TYPE_LABELS[field.tipo]}
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${field.nome}`}
        aria-pressed={editing}
        className="rounded p-1 text-faint transition-colors hover:bg-surface-hi hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={editing}
        aria-label={`Remover ${field.nome}`}
        className="rounded p-1 text-faint transition-colors hover:bg-surface-hi hover:text-danger disabled:pointer-events-none disabled:opacity-40"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}
