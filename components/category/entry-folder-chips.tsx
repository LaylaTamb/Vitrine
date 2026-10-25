"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Folder, Plus } from "lucide-react"

import { intoTargetId } from "@/lib/domain/drag"
import { cn } from "@/lib/utils"

interface ChipFolder {
  id: string
  name: string
}

/**
 * As subpastas do nível aberto, em chips numa linha (no celular, uma fileira
 * que rola de lado): não empurram os itens para baixo como os cards faziam.
 * Cada chip abre a subpasta, recebe o item arrastado para o miolo dele e, para
 * o dono, se arrasta para mudar a ordem ou entrar em outra subpasta (no dedo,
 * segurando um instante).
 */
export function EntryFolderChips({
  folders,
  countOf,
  onOpen,
  onCreate,
  canEdit,
}: {
  folders: ChipFolder[]
  /** Quantos itens a subpasta tem, contando as de dentro. */
  countOf: (folderId: string) => number
  onOpen: (folderId: string) => void
  /** O chip "＋ Pasta": só o dono. */
  onCreate?: () => void
  canEdit: boolean
}) {
  return (
    <SortableContext items={folders.map((folder) => folder.id)} strategy={rectSortingStrategy}>
      {/* `py-1`: a rolagem lateral cortaria o anel do chip que recebe o arraste. */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        <span className="plaque shrink-0">Pastas</span>
        {folders.map((folder) => (
          <FolderChip
            key={folder.id}
            folder={folder}
            count={countOf(folder.id)}
            onOpen={() => onOpen(folder.id)}
            canEdit={canEdit}
          />
        ))}
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
          >
            <Plus className="size-3.5" /> Pasta
          </button>
        ) : null}
      </div>
    </SortableContext>
  )
}

function FolderChip({
  folder,
  count,
  onOpen,
  canEdit,
}: {
  folder: ChipFolder
  count: number
  onOpen: () => void
  canEdit: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    disabled: !canEdit,
  })
  // O miolo do chip (não as pontas): as pontas continuam servindo para reordenar.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: intoTargetId(folder.id),
    disabled: !canEdit,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      data-hold-drag
      onClick={onOpen}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative inline-flex max-w-60 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors select-none [-webkit-touch-callout:none] hover:border-line-hi hover:text-foreground",
        isDragging && "z-10 border-line-hi opacity-90",
        isOver && "border-brand text-foreground ring-2 ring-brand-dim"
      )}
    >
      {canEdit ? (
        <span
          ref={setDropRef}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 inset-x-[25%]"
        />
      ) : null}
      <Folder aria-hidden className="size-3.5 shrink-0 text-brand" />
      <span className="min-w-0 truncate">{folder.name}</span>
      <span className="shrink-0 text-xs text-faint">{count}</span>
    </button>
  )
}
