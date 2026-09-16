"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"

import { FIELD_TYPE_LABELS } from "@/lib/domain/fields"
import type { FieldDef } from "@/lib/domain/types"

/** Uma linha do editor de estrutura, arrastável. */
export function FieldRow({
  field,
  onRemove,
}: {
  field: FieldDef
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-2 py-2 ${
        isDragging ? "z-10 border-line-hi opacity-90" : ""
      }`}
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
        ) : null}
      </div>

      <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.68rem] text-muted-foreground">
        {FIELD_TYPE_LABELS[field.tipo]}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${field.nome}`}
        className="rounded p-1 text-faint transition-colors hover:bg-surface-hi hover:text-danger"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}
