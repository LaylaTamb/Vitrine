"use client"

import Link from "next/link"
import { DndContext } from "@dnd-kit/core"
import { SortableContext } from "@dnd-kit/sortable"
import { CheckSquare, FolderOpen, FolderPlus, ImageOff, Plus, SlidersHorizontal } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { CategoryEditor } from "@/components/category/category-editor"
import { DeleteEntryFolderDialog } from "@/components/category/delete-entry-folder-dialog"
import { FilterBar } from "@/components/category/filter-bar"
import { StatsPanel } from "@/components/category/stats-panel"
import { CollectionCard } from "@/components/collection/collection-card"
import { FolderDialog } from "@/components/collection/folder-dialog"
import { MoveDialog } from "@/components/collection/move-dialog"
import { BulkBar } from "@/components/entry/bulk-bar"
import { EntryCard } from "@/components/entry/entry-card"
import { EntryForm } from "@/components/entry/entry-form"
import { EntryRow } from "@/components/entry/entry-row"
import { EmptyState } from "@/components/layout/empty-state"
import { LevelNav, type Crumb } from "@/components/layout/level-nav"
import { PageHeader } from "@/components/layout/page-header"
import { useFolderParam } from "@/components/layout/use-folder-param"
import type { ViewMode } from "@/components/layout/view-toggle"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { breadcrumbOf, foldersOf, type TreeFolder } from "@/lib/domain/collections"
import { entryFolderTotals, itemsAt, resolveFolderId } from "@/lib/domain/entry-folders"
import {
  applyCategoryFilter,
  isCategoryFilterActive,
  tagsPresentIn,
  type CategoryFilter,
} from "@/lib/domain/filter"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, EntryFolder, EntryView, Profile, Tag } from "@/lib/domain/types"
import { withFolder } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const VIEW_STORAGE_KEY = "vitrine:categoria:view"

type Tab = "itens" | "numeros"

interface FolderTarget {
  id: string
  name: string
  parentId: string | null
}

export function CategoryView({
  category,
  owner,
  siblings,
  views,
  tags,
  entryFolders,
  collectionFolders,
  collectionsHref,
  canEdit,
  initialFilter,
  initialTab,
}: {
  category: Category
  owner: Profile | null
  siblings: Pick<Category, "id" | "name" | "icon" | "display_order">[]
  views: EntryView[]
  tags: Tag[]
  /** As subpastas desta categoria. */
  entryFolders: EntryFolder[]
  /** As pastas das Coleções do dono — só para a trilha e o Voltar. */
  collectionFolders: TreeFolder[]
  /** Onde ficam as Coleções do dono: `/`, `/u/<username>` ou `/demo`. */
  collectionsHref: string
  canEdit: boolean
  initialFilter: CategoryFilter
  initialTab: Tab
}) {
  const { actions, basePath } = useVitrine()
  const [folderParam, setFolderParam] = useFolderParam()
  const currentFolderId = resolveFolderId(entryFolders, folderParam)

  const [filter, setFilter] = useState<CategoryFilter>(initialFilter)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [view, setView] = useState<ViewMode>("grid")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EntryView | null>(null)
  const [structureOpen, setStructureOpen] = useState(false)
  const [deleting, setDeleting] = useState<EntryView | null>(null)

  const [folderDialog, setFolderDialog] = useState<{
    open: boolean
    folder?: { id: string; name: string } | null
  }>({ open: false })
  const [movingFolder, setMovingFolder] = useState<FolderTarget | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<FolderTarget | null>(null)

  const [selected, setSelected] = useState<string[]>([])
  const [selecting, setSelecting] = useState(false)
  const [lastIndex, setLastIndex] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
      if (stored === "grid" || stored === "list") setView(stored)
    } catch {
      // storage bloqueado: segue no padrão
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

  /**
   * URL compartilhável sem custo: `replaceState` num debounce de 400 ms.
   * `router.replace` re-executaria o Server Component a cada tecla — o erro da
   * v1 em outra roupa. Parte de `window.location`, então a `?pasta=` aberta
   * continua lá.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href)
      const set = (key: string, value: string) => {
        if (value) url.searchParams.set(key, value)
        else url.searchParams.delete(key)
      }
      set("q", filter.query.trim())
      set("min", filter.minRating.trim())
      set("max", filter.maxRating.trim())
      set("tags", filter.tagIds.join(","))
      set("modo", filter.mode === "and" ? "" : filter.mode)
      set("ordem", filter.sort === "recent" ? "" : filter.sort)
      set("aba", tab === "itens" ? "" : tab)
      window.history.replaceState(null, "", url.toString())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [filter, tab])

  // O filtro olha só os itens soltos no nível aberto — subpastas são navegação.
  const levelViews = useMemo(() => itemsAt(views, currentFolderId), [views, currentFolderId])
  // Subpastas nascem todas com display_order 0: na prática, ordem alfabética.
  const levelFolders = useMemo(
    () => foldersOf(entryFolders, currentFolderId),
    [entryFolders, currentFolderId]
  )
  const totals = useMemo(() => entryFolderTotals(entryFolders, views), [entryFolders, views])
  const filtered = useMemo(() => applyCategoryFilter(levelViews, filter), [levelViews, filter])
  const active = isCategoryFilterActive(filter)
  const levelTags = useMemo(() => tagsPresentIn(levelViews), [levelViews])

  const clearSelection = useCallback(() => {
    setSelected([])
    setSelecting(false)
    setLastIndex(null)
  }, [])

  // Trocar de pasta começa uma seleção nova.
  useEffect(() => {
    clearSelection()
  }, [currentFolderId, clearSelection])

  // Item que saiu do recorte não pode continuar selecionado.
  useEffect(() => {
    setSelected((current) => current.filter((id) => filtered.some((item) => item.id === id)))
  }, [filtered])

  // ---- trilha: Coleções › pastas › Categoria › subpastas -------------------
  const trail = useMemo((): Crumb[] => {
    const collectionTrail = breadcrumbOf(collectionFolders, category.folder_id)
    const folderTrail = breadcrumbOf(entryFolders, currentFolderId)
    return [
      { key: "colecoes", label: "Coleções", href: collectionsHref },
      ...collectionTrail.map((folder) => ({
        key: `colecao-${folder.id}`,
        label: folder.name,
        href: withFolder(collectionsHref, folder.id),
      })),
      {
        key: "categoria",
        label: `${category.icon ? `${category.icon} ` : ""}${category.name}`,
        onClick: () => setFolderParam(null),
      },
      ...folderTrail.map((folder) => ({
        key: `pasta-${folder.id}`,
        label: folder.name,
        onClick: () => setFolderParam(folder.id),
      })),
    ]
  }, [collectionFolders, category, entryFolders, currentFolderId, collectionsHref, setFolderParam])

  const currentFolder = entryFolders.find((folder) => folder.id === currentFolderId) ?? null

  function toggleSelect(index: number, event: React.MouseEvent) {
    const target = filtered[index]
    if (!target) return

    setSelecting(true)

    if (event.shiftKey && lastIndex !== null) {
      const [from, to] = lastIndex < index ? [lastIndex, index] : [index, lastIndex]
      const range = filtered.slice(from, to + 1).map((item) => item.id)
      setSelected((current) => [...new Set([...current, ...range])])
      return
    }

    setLastIndex(index)
    setSelected((current) =>
      current.includes(target.id)
        ? current.filter((id) => id !== target.id)
        : [...current, target.id]
    )
  }

  async function confirmDelete() {
    if (!deleting) return
    const result = await actions.deleteEntry({ id: deleting.id, categoryId: category.id })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Item excluído.")
    setDeleting(null)
  }

  function openNewEntry() {
    setEditing(null)
    setFormOpen(true)
  }

  function folderSubtitle(folderId: string): string {
    const total = totals.get(folderId)
    if (!total || (total.entries === 0 && total.folders === 0)) return "Pasta vazia"
    const parts: string[] = []
    if (total.folders > 0) parts.push(plural(total.folders, "subpasta", "subpastas"))
    parts.push(itemCount(total.entries))
    return parts.join(" · ")
  }

  function clearFilters() {
    setFilter((current) => ({ ...current, query: "", minRating: "", maxRating: "", tagIds: [] }))
  }

  const deletingParentLabel = (() => {
    if (!deletingFolder) return ""
    const parent = entryFolders.find((folder) => folder.id === deletingFolder.parentId)
    return parent ? `“${parent.name}”` : "a raiz da categoria"
  })()

  const levelIsEmpty = levelViews.length === 0 && levelFolders.length === 0

  return (
    <>
      <PageHeader
        label={owner && !canEdit ? `coleção de ${owner.display_name || owner.username}` : "sua coleção"}
        title={
          <span className="flex items-center gap-2">
            {category.icon ? <span aria-hidden>{category.icon}</span> : null}
            <span>{category.name}</span>
          </span>
        }
        subtitle={
          entryFolders.length > 0
            ? `${itemCount(views.length)} · ${plural(entryFolders.length, "pasta", "pastas")}`
            : itemCount(views.length)
        }
        actions={
          canEdit ? (
            <>
              <Button variant="outline" size="lg" onClick={() => setStructureOpen(true)}>
                <SlidersHorizontal className="size-4" /> Estrutura
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setFolderDialog({ open: true, folder: null })}
              >
                <FolderPlus className="size-4" /> Nova pasta
              </Button>
              <Button size="lg" onClick={openNewEntry}>
                <Plus className="size-4" /> Novo item
              </Button>
            </>
          ) : null
        }
      />

      <LevelNav trail={trail} />

      {siblings.length > 1 ? (
        <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {siblings.map((sibling) => (
            <Link
              key={sibling.id}
              href={`${basePath}/categoria/${sibling.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                sibling.id === category.id
                  ? "border-brand-dim bg-brand-wash text-foreground"
                  : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
              )}
            >
              {sibling.icon ? `${sibling.icon} ` : ""}
              {sibling.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-5 flex items-center gap-1 border-b border-line">
        {(
          [
            { id: "itens" as const, label: "Itens" },
            { id: "numeros" as const, label: "Números" },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === item.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <FilterBar
          filter={filter}
          onChange={setFilter}
          onClear={clearFilters}
          tags={levelTags}
          view={view}
          onViewChange={changeView}
          active={active}
        />

        {tab === "itens" && levelFolders.length > 0 ? (
          <DndContext id="dnd-subpastas">
            <SortableContext items={levelFolders.map((folder) => folder.id)}>
              <div
                className={cn(
                  view === "grid"
                    ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                    : "flex flex-col gap-2"
                )}
              >
                {levelFolders.map((folder) => (
                  <CollectionCard
                    key={folder.id}
                    id={folder.id}
                    kind="folder"
                    name={folder.name}
                    icon={null}
                    subtitle={folderSubtitle(folder.id)}
                    onOpen={() => setFolderParam(folder.id)}
                    canEdit={canEdit}
                    sortable={false}
                    view={view}
                    onMove={() =>
                      setMovingFolder({
                        id: folder.id,
                        name: folder.name,
                        parentId: folder.parent_folder_id,
                      })
                    }
                    onEdit={() =>
                      setFolderDialog({ open: true, folder: { id: folder.id, name: folder.name } })
                    }
                    onDelete={() =>
                      setDeletingFolder({
                        id: folder.id,
                        name: folder.name,
                        parentId: folder.parent_folder_id,
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}

        {tab === "numeros" ? (
          <StatsPanel views={filtered} estrutura={category.estrutura} filterActive={active} />
        ) : views.length === 0 && entryFolders.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title="Vitrine vazia"
            description={
              canEdit
                ? "Nenhum item por aqui ainda. Adicione o primeiro."
                : "Esta coleção ainda não tem itens."
            }
            action={
              canEdit ? (
                <Button onClick={openNewEntry}>
                  <Plus className="size-4" /> Novo item
                </Button>
              ) : null
            }
          />
        ) : levelIsEmpty ? (
          <EmptyState
            icon={FolderOpen}
            title="Pasta vazia"
            description={
              canEdit
                ? `Nada em “${currentFolder?.name ?? category.name}” ainda. Crie um item aqui ou mova itens para cá pela seleção.`
                : "Esta pasta ainda não tem itens."
            }
            action={
              canEdit ? (
                <Button onClick={openNewEntry}>
                  <Plus className="size-4" /> Novo item
                </Button>
              ) : null
            }
          />
        ) : levelViews.length === 0 ? null : filtered.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title="Nada bateu com o filtro"
            description={
              currentFolder
                ? `Nenhum item de “${currentFolder.name}” passa por esse recorte. O filtro olha só esta pasta.`
                : "Nenhum item deste nível passa por esse recorte. O filtro não olha dentro das subpastas."
            }
            action={
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {active
                  ? `${filtered.length} de ${itemCount(levelViews.length)}`
                  : itemCount(levelViews.length)}
                {levelFolders.length > 0 || currentFolder ? " neste nível" : ""}
              </p>
              {canEdit && selecting ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(filtered.map((item) => item.id))}
                >
                  <CheckSquare className="size-3.5" /> Selecionar todos (do filtro atual)
                </Button>
              ) : null}
            </div>

            <div
              className={cn(
                view === "grid"
                  ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  : "flex flex-col gap-2",
                selected.length > 0 && "pb-16"
              )}
            >
              {filtered.map((item, index) =>
                view === "grid" ? (
                  <EntryCard
                    key={item.id}
                    view={item}
                    canEdit={canEdit}
                    categoryColor={category.color}
                    selectable={canEdit}
                    selecting={selecting}
                    selected={selected.includes(item.id)}
                    onToggleSelect={(event) => toggleSelect(index, event)}
                    onEdit={() => {
                      setEditing(item)
                      setFormOpen(true)
                    }}
                    onDelete={() => setDeleting(item)}
                  />
                ) : (
                  <EntryRow
                    key={item.id}
                    view={item}
                    canEdit={canEdit}
                    categoryColor={category.color}
                    selectable={canEdit}
                    selecting={selecting}
                    selected={selected.includes(item.id)}
                    onToggleSelect={(event) => toggleSelect(index, event)}
                    onEdit={() => {
                      setEditing(item)
                      setFormOpen(true)
                    }}
                    onDelete={() => setDeleting(item)}
                  />
                )
              )}
            </div>
          </>
        )}
      </div>

      {canEdit ? (
        <>
          <EntryForm
            open={formOpen}
            onOpenChange={setFormOpen}
            categoryId={category.id}
            estrutura={category.estrutura}
            tags={tags}
            entry={editing}
            folders={entryFolders}
            defaultFolderId={currentFolderId}
          />

          <CategoryEditor
            open={structureOpen}
            onOpenChange={setStructureOpen}
            initial={{
              id: category.id,
              name: category.name,
              icon: category.icon,
              color: category.color,
              estrutura: category.estrutura,
            }}
          />

          <FolderDialog
            open={folderDialog.open}
            onOpenChange={(open) => setFolderDialog((state) => ({ ...state, open }))}
            folder={folderDialog.folder}
            scope={{ kind: "category", categoryId: category.id, parentFolderId: currentFolderId }}
          />

          <MoveDialog
            open={movingFolder !== null}
            onOpenChange={(open) => {
              if (!open) setMovingFolder(null)
            }}
            folders={entryFolders}
            rootLabel="Raiz da categoria"
            target={movingFolder ? { kind: "entryFolder", ...movingFolder } : null}
          />

          <DeleteEntryFolderDialog
            folder={deletingFolder}
            totals={deletingFolder ? totals.get(deletingFolder.id) : undefined}
            parentLabel={deletingParentLabel}
            onOpenChange={(open) => {
              if (!open) setDeletingFolder(null)
            }}
          />

          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null)
            }}
            title="Excluir item"
            description={`"${deleting?.name ?? ""}" some da vitrine. Não dá para desfazer.`}
            onConfirm={confirmDelete}
          />

          {selected.length > 0 ? (
            <BulkBar
              categoryId={category.id}
              selectedIds={selected}
              onClear={clearSelection}
              siblings={siblings}
              tags={tags}
              folders={entryFolders}
              currentFolderId={currentFolderId}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
