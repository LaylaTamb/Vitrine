"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, X } from "lucide-react"

import { FIELD_TYPE_ICONS } from "@/components/category/field-type-icon"
import { FIELD_TYPE_LABELS, FIELD_TYPE_SHORT_LABELS } from "@/lib/domain/fields"
import type { FieldDef } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** "Lista · Salão, Delivery", "Moeda · R$" ou o nome do tipo. */
function detailOf(field: FieldDef): string {
  if (field.tipo === "select" && field.opcoes?.length) {
    return `${FIELD_TYPE_SHORT_LABELS.select} · ${field.opcoes.join(", ")}`
  }
  if (field.tipo === "currency" && field.moeda) {
    return `${FIELD_TYPE_SHORT_LABELS.currency} · ${field.moeda}`
  }
  return FIELD_TYPE_LABELS[field.tipo]
}

/** Uma linha do editor de estrutura, arrastável: o tipo vira um ícone. */
export function FieldRow({
  field,
  editing = false,
  flash = false,
  onEdit,
  onRemove,
}: {
  field: FieldDef
  /** Está sendo editada agora (destacada, remover desabilitado). */
  editing?: boolean
  /** Acabou de entrar na lista: acende por um instante. */
  flash?: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const Icon = FIELD_TYPE_ICONS[field.tipo]

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-1 transition-colors duration-500",
        isDragging && "z-10 border-line-hi opacity-90",
        (editing || flash) && "border-brand-dim bg-brand-wash"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1.5 text-faint hover:text-foreground active:cursor-grabbing"
        aria-label={`Reordenar ${field.nome}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span
        title={FIELD_TYPE_LABELS[field.tipo]}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-hi text-muted-foreground"
      >
        <Icon aria-hidden className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{field.nome}</p>
        <p className="truncate text-xs text-faint">{detailOf(field)}</p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${field.nome}`}
        aria-pressed={editing}
        className="rounded-md p-2 text-faint transition-colors hover:bg-surface-hi hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={editing}
        aria-label={`Remover ${field.nome}`}
        className="rounded-md p-2 text-faint transition-colors hover:bg-surface-hi hover:text-danger disabled:pointer-events-none disabled:opacity-40"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}
