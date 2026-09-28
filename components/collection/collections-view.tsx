"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { FolderPlus, Library, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { CategoryEditor, type CategoryEditorValue } from "@/components/category/category-editor"
import { CollectionCard } from "@/components/collection/collection-card"
import { FolderDialog } from "@/components/collection/folder-dialog"
import { MoveDialog } from "@/components/collection/move-dialog"
import { EmptyState } from "@/components/layout/empty-state"
import { LevelNav } from "@/components/layout/level-nav"
import { PageHeader } from "@/components/layout/page-header"
import { useFolderParam } from "@/components/layout/use-folder-param"
import { ViewToggle, type ViewMode } from "@/components/layout/view-toggle"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { breadcrumbOf, folderTotals, levelItems } from "@/lib/domain/collections"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, Folder } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

const VIEW_STORAGE_KEY = "vitrine:colecoes:view"

interface MoveTargetState {
  kind: "folder" | "category"
  id: string
  name: string
  parentId: string | null
}

interface DeleteTargetState {
  kind: "folder" | "category"
  id: string
  name: string
  description: string
}

export function CollectionsView({
  folders,
  categories,
  counts,
  canEdit,
  headerLabel,
  headerTitle,
  headerSubtitle,
}: {
  folders: Folder[]
  categories: Category[]
  counts: Record<string, number>
  canEdit: boolean
  headerLabel: string
  headerTitle: string
  headerSubtitle: string
}) {
  const { actions, basePath } = useVitrine()
  const [folderParam, setCurrentFolderId] = useFolderParam()
  // Link velho de uma pasta que não existe mais (ou de outra pessoa): raiz.
  const currentFolderId =
    folderParam && folders.some((folder) => folder.id === folderParam) ? folderParam : null
  const [view, setView] = useState<ViewMode>("grid")
  const [order, setOrder] = useState<string[] | null>(null)

  const [folderDialog, setFolderDialog] = useState<{
    open: boolean
    folder?: { id: string; name: string } | null
  }>({ open: false })
  const [categoryEditor, setCategoryEditor] = useState<{
    open: boolean
    initial: CategoryEditorValue
  }>({ open: false, initial: { name: "", icon: null, color: null, estrutura: [] } })
  const [moveTarget, setMoveTarget] = useState<MoveTargetState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
      if (stored === "grid" || stored === "list") setView(stored)
    } catch {
      // modo privado / storage bloqueado: segue no padrão
    }
  }, [])

  function changeView(next: ViewMode) {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // idem
    }
  }

  // Dado novo do servidor manda: a ordem otimista é descartada.
  useEffect(() => {
    setOrder(null)
  }, [folders, categories])

  useEffect(() => {
    setOrder(null)
  }, [currentFolderId])

  const totals = useMemo(
    () => folderTotals(folders, categories, counts),
    [folders, categories, counts]
  )

  const items = useMemo(() => {
    const base = levelItems(folders, categories, currentFolderId)
    if (!order) return base
    const byId = new Map(base.map((item) => [item.id, item]))
    const sorted = order.map((id) => byId.get(id)).filter((item) => item !== undefined)
    for (const item of base) {
      if (!order.includes(item.id)) sorted.push(item)
    }
    return sorted
  }, [folders, categories, currentFolderId, order])

  const trail = useMemo(() => breadcrumbOf(folders, currentFolderId), [folders, currentFolderId])

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = items.map((item) => item.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const previous = order
    const nextIds = arrayMove(ids, from, to)
    setOrder(nextIds)

    const byId = new Map(items.map((item) => [item.id, item]))
    const payload = nextIds
      .map((id) => byId.get(id))
      .filter((item) => item !== undefined)
      .map((item) => ({ kind: item.kind, id: item.id }))

    const result = await actions.reorderLevel({ items: payload })
    if (!result.ok) {
      setOrder(previous)
      toast.error(result.error)
    }
  }

  function folderSubtitle(folderId: string): string {
    const total = totals.get(folderId)
    if (!total || (total.categories === 0 && total.folders === 0)) return "Pasta vazia"
    const parts: string[] = []
    if (total.categories > 0) parts.push(plural(total.categories, "categoria", "categorias"))
    else parts.push(plural(total.folders, "subpasta", "subpastas"))
    parts.push(itemCount(total.entries))
    return parts.join(" · ")
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const result =
      deleteTarget.kind === "folder"
        ? await actions.deleteFolder({ id: deleteTarget.id })
        : await actions.deleteCategory({ id: deleteTarget.id })

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(deleteTarget.kind === "folder" ? "Pasta excluída." : "Categoria excluída.")
    setDeleteTarget(null)
  }

  const strategy = view === "grid" ? rectSortingStrategy : verticalListSortingStrategy

  return (
    <>
      <PageHeader
        label={headerLabel}
        title={headerTitle}
        subtitle={headerSubtitle}
        actions={
          <>
            {canEdit ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setFolderDialog({ open: true, folder: null })}
                >
                  <FolderPlus className="size-4" /> Nova pasta
                </Button>
                <Button
                  size="lg"
                  onClick={() =>
                    setCategoryEditor({
                      open: true,
                      initial: { name: "", icon: null, color: null, estrutura: [] },
                    })
                  }
                >
                  <Plus className="size-4" /> Nova categoria
                </Button>
              </>
            ) : null}
            <ViewToggle value={view} onChange={changeView} />
          </>
        }
      />

      <LevelNav
        trail={[
          { key: "colecoes", label: "Coleções", onClick: () => setCurrentFolderId(null) },
          ...trail.map((folder) => ({
            key: folder.id,
            label: folder.name,
            onClick: () => setCurrentFolderId(folder.id),
          })),
        ]}
      />

      {items.length === 0 && !canEdit ? (
        <EmptyState
          icon={Library}
          title="Nada por aqui"
          description="Esta pasta não tem nenhuma categoria."
        />
      ) : items.length === 0 && canEdit ? (
        <EmptyState
          icon={Library}
          title="Vitrine vazia"
          description="Crie a primeira categoria e comece a catalogar o que você consome."
          action={
            <Button
              onClick={() =>
                setCategoryEditor({ open: true, initial: { name: "", icon: null, color: null, estrutura: [] } })
              }
            >
              <Plus className="size-4" /> Nova categoria
            </Button>
          }
        />
      ) : (
        // `id` fixo: sem ele o dnd-kit numera os ids de acessibilidade com um
        // contador global, e o HTML do servidor não bate com o do navegador.
        <DndContext
          id="dnd-colecoes"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={strategy}>
            <div
              className={cn(
                view === "grid"
                  ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  : "flex flex-col gap-2"
              )}
            >
              {items.map((item) =>
                item.kind === "folder" ? (
                  <CollectionCard
                    key={item.id}
                    id={item.id}
                    kind="folder"
                    name={item.folder.name}
                    icon={null}
                    subtitle={folderSubtitle(item.id)}
                    onOpen={() => setCurrentFolderId(item.id)}
                    canEdit={canEdit}
                    sortable={canEdit}
                    view={view}
                    onMove={() =>
                      setMoveTarget({
                        kind: "folder",
                        id: item.id,
                        name: item.folder.name,
                        parentId: item.folder.parent_folder_id,
                      })
                    }
                    onEdit={() =>
                      setFolderDialog({
                        open: true,
                        folder: { id: item.id, name: item.folder.name },
                      })
                    }
                    onDelete={() => {
                      const total = totals.get(item.id)
                      setDeleteTarget({
                        kind: "folder",
                        id: item.id,
                        name: item.folder.name,
                        description:
                          total && (total.categories > 0 || total.entries > 0)
                            ? `Essa pasta contém ${plural(total.categories, "categoria", "categorias")} e ${itemCount(total.entries)} no total. Excluir tudo?`
                            : "Essa pasta está vazia. Excluir?",
                      })
                    }}
                  />
                ) : (
                  <CollectionCard
                    key={item.id}
                    id={item.id}
                    kind="category"
                    name={item.category.name}
                    icon={item.category.icon}
                    subtitle={itemCount(counts[item.id] ?? 0)}
                    href={`${basePath}/categoria/${item.id}`}
                    canEdit={canEdit}
                    sortable={canEdit}
                    view={view}
                    onMove={() =>
                      setMoveTarget({
                        kind: "category",
                        id: item.id,
                        name: item.category.name,
                        parentId: item.category.folder_id,
                      })
                    }
                    onEdit={() =>
                      setCategoryEditor({
                        open: true,
                        initial: {
                          id: item.id,
                          name: item.category.name,
                          icon: item.category.icon,
                          color: item.category.color,
                          estrutura: item.category.estrutura,
                        },
                      })
                    }
                    onDelete={() =>
                      setDeleteTarget({
                        kind: "category",
                        id: item.id,
                        name: item.category.name,
                        description: `Isso apaga a categoria e ${itemCount(counts[item.id] ?? 0)} dentro dela. Não dá para desfazer.`,
                      })
                    }
                  />
                )
              )}

              {canEdit && view === "grid" ? (
                <button
                  type="button"
                  onClick={() =>
                    setCategoryEditor({
                      open: true,
                      initial: { name: "", icon: null, color: null, estrutura: [] },
                    })
                  }
                  className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-transparent text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
                >
                  <Plus className="size-4" />
                  <span className="text-xs">Nova categoria</span>
                </button>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {canEdit ? (
        <>
          <FolderDialog
            open={folderDialog.open}
            onOpenChange={(open) => setFolderDialog((state) => ({ ...state, open }))}
            folder={folderDialog.folder}
            scope={{ kind: "collection", parentFolderId: currentFolderId }}
          />

          <CategoryEditor
            open={categoryEditor.open}
            onOpenChange={(open) => setCategoryEditor((state) => ({ ...state, open }))}
            initial={categoryEditor.initial}
            folderId={currentFolderId}
          />

          <MoveDialog
            open={moveTarget !== null}
            onOpenChange={(open) => {
              if (!open) setMoveTarget(null)
            }}
            folders={folders}
            target={moveTarget}
          />

          <ConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
            title={deleteTarget?.kind === "folder" ? "Excluir pasta" : "Excluir categoria"}
            description={deleteTarget?.description ?? ""}
            onConfirm={confirmDelete}
          />
        </>
      ) : null}
    </>
  )
}
