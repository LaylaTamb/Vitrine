"use client"

import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Plus } from "lucide-react"

import { CollectionCard } from "@/components/collection/collection-card"
import type { ViewMode } from "@/components/layout/view-toggle"
import { itemCount } from "@/lib/domain/format"
import { GRID_CLASSES, type GridSize } from "@/lib/domain/grid-size"
import { cn } from "@/lib/utils"

interface GridFolder {
  id: string
  name: string
}

/**
 * As subpastas do nível aberto, no mesmo cartão das pastas das Coleções e do
 * tamanho dos itens (a grade segue o P / M / G; na Lista, linhas). Cada uma
 * abre a subpasta, recebe o item arrastado para o miolo dela e, para o dono,
 * se arrasta pela alça para mudar a ordem ou entrar em outra subpasta.
 */
export function EntryFolderGrid({
  folders,
  countOf,
  onOpen,
  onCreate,
  canEdit,
  view,
  gridSize,
}: {
  folders: GridFolder[]
  /** Quantos itens a subpasta tem, contando as de dentro. */
  countOf: (folderId: string) => number
  onOpen: (folderId: string) => void
  /** O "＋ Nova subpasta" no fim da grade: só o dono. */
  onCreate?: () => void
  canEdit: boolean
  view: ViewMode
  gridSize: GridSize
}) {
  const list = view === "list"
  return (
    <SortableContext
      items={folders.map((folder) => folder.id)}
      strategy={list ? verticalListSortingStrategy : rectSortingStrategy}
    >
      <div className={list ? "flex flex-col gap-2" : cn("grid", GRID_CLASSES[gridSize])}>
        {folders.map((folder) => (
          <CollectionCard
            key={folder.id}
            id={folder.id}
            kind="folder"
            name={folder.name}
            icon={null}
            subtitle={itemCount(countOf(folder.id))}
            onOpen={() => onOpen(folder.id)}
            sortable={canEdit}
            view={view}
            dropInto={canEdit}
          />
        ))}
        {onCreate && !list ? (
          <button
            type="button"
            onClick={onCreate}
            className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-transparent text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
          >
            <Plus className="size-4" />
            <span className="text-xs">Nova subpasta</span>
          </button>
        ) : null}
      </div>
    </SortableContext>
  )
}
