"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
import Link from "next/link"
import { FolderPlus, Library, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { restoreTrashAction } from "@/app/lixeira/actions"

import {
  CategoryEditor,
  NEW_CATEGORY,
  type CategoryEditorValue,
} from "@/components/category/category-editor"
import { CollectionCard } from "@/components/collection/collection-card"
import {
  CollectionsSearchBar,
  CollectionsSearchResults,
} from "@/components/collection/collections-search"
import { FolderDialog } from "@/components/collection/folder-dialog"
import { InboxCard } from "@/components/collection/inbox-card"
import { PrivacyChip, PrivacyNote } from "@/components/collection/privacy-switch"
import { moveCollision } from "@/components/layout/drag-move"
import { EmptyState } from "@/components/layout/empty-state"
import { LevelNav } from "@/components/layout/level-nav"
import { MoreMenu } from "@/components/layout/more-menu"
import { PageHeader } from "@/components/layout/page-header"
import { GridSizeToggle } from "@/components/layout/grid-size-toggle"
import { useFolderParam } from "@/components/layout/use-folder-param"
import { useStoredPreference } from "@/components/layout/use-stored-preference"
import { ViewToggle, type ViewMode } from "@/components/layout/view-toggle"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { breadcrumbOf, folderGlyphs, folderTotals, levelItems } from "@/lib/domain/collections"
import { readDropTarget } from "@/lib/domain/drag"
import { canFavorite, withFavorite } from "@/lib/domain/favorites"
import { itemCount, plural } from "@/lib/domain/format"
import { DEFAULT_GRID_SIZE, GRID_CLASSES, normalizeGridSize } from "@/lib/domain/grid-size"
import { splitInbox } from "@/lib/domain/inbox"
import {
  restrictingAncestor,
  restrictionNote,
  visibilityOf,
  type Visibility,
} from "@/lib/domain/privacy"
import type { Category, Folder } from "@/lib/domain/types"
import { isSearching } from "@/lib/domain/search"
import { cn } from "@/lib/utils"

const VIEW_STORAGE_KEY = "vitrine:colecoes:view"
const GRID_STORAGE_KEY = "vitrine:colecoes:grade"

function parseView(raw: string | null): ViewMode | null {
  return raw === "grid" || raw === "list" ? raw : null
}

/** A pasta aberta, a caminho da Lixeira (a categoria se exclui no "⋯" dela). */
interface DeleteTargetState {
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
  defaultVisibility = "public",
  top,
  searchable = false,
  trashCount,
  favoriteIds,
  covers,
  embedded = false,
  filtersHref,
}: {
  folders: Folder[]
  categories: Category[]
  counts: Record<string, number>
  canEdit: boolean
  headerLabel: string
  headerTitle: string
  headerSubtitle: string
  /** O padrão do perfil para pasta e categoria novas. */
  defaultVisibility?: Visibility
  /**
   * Antes do cabeçalho: o cartão do perfil (com o `h1` — o título das
   * coleções desce para `h2`).
   */
  top?: ReactNode
  /** As suas Coleções: a barra de busca (pastas, categorias e itens). */
  searchable?: boolean
  /** As suas Coleções: o ícone da Lixeira no canto, com quantas coisas há nela. */
  trashCount?: number
  /** category_id → até 3 fotos para a capa do card (migração 40). */
  covers?: Record<string, string[]>
  /** Dentro da aba Coleções do Perfil: sem o título grande. */
  embedded?: boolean
  /** O botão Filtros (o antigo Filtro geral): para onde ele leva. */
  filtersHref?: string
  /**
   * As suas Coleções: as favoritas (ids, na ordem) — a estrela nos cards das
   * categorias e a do canto, que abre só elas. Ausente = sem estrelas.
   */
  favoriteIds?: string[]
}) {
  const { actions } = useVitrine()
  // Com 2 letras ou mais, os resultados ficam no lugar da grade.
  const [query, setQuery] = useState("")
  const searching = searchable && isSearching(query)
  const [folderParam, setCurrentFolderId] = useFolderParam()
  // Link velho de uma pasta que não existe mais (ou de outra pessoa): raiz.
  const currentFolderId =
    folderParam && folders.some((folder) => folder.id === folderParam) ? folderParam : null
  const [view, changeView] = useStoredPreference<ViewMode>(VIEW_STORAGE_KEY, "grid", parseView)
  // Vale para os cards de pasta e de categoria.
  const [gridSize, changeGridSize] = useStoredPreference(
    GRID_STORAGE_KEY,
    DEFAULT_GRID_SIZE,
    normalizeGridSize
  )
  const [order, setOrder] = useState<string[] | null>(null)

  const [folderDialog, setFolderDialog] = useState<{
    open: boolean
    folder?: { id: string; name: string } | null
  }>({ open: false })
  const [categoryEditor, setCategoryEditor] = useState<{
    open: boolean
    initial: CategoryEditorValue
  }>({ open: false, initial: NEW_CATEGORY })
  // Arrastado para outra pasta: some daqui na hora (otimista); o dado novo
  // do servidor manda de novo.
  const [movedAway, setMovedAway] = useState<string[]>([])
  // As favoritas com o toque que acabou de acontecer (otimista); o dado novo
  // do servidor manda de novo.
  const [favoritesOptimistic, setFavoritesOptimistic] = useState<string[] | null>(null)
  const favorites = useMemo(
    () => favoritesOptimistic ?? favoriteIds ?? [],
    [favoritesOptimistic, favoriteIds]
  )
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  useEffect(() => {
    setFavoritesOptimistic(null)
  }, [favoriteIds])
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Dado novo do servidor manda: a ordem otimista é descartada.
  useEffect(() => {
    setOrder(null)
    setMovedAway([])
  }, [folders, categories])

  useEffect(() => {
    setOrder(null)
  }, [currentFolderId])

  // A "A organizar" tem lugar fixo no topo da raiz: fica fora da grade
  // arrastável e das contas das pastas.
  const { inbox, others } = useMemo(() => splitInbox(categories), [categories])

  const totals = useMemo(() => folderTotals(folders, others, counts), [folders, others, counts])

  const items = useMemo(() => {
    const level = levelItems(folders, others, currentFolderId)
    // Para quem visita, pasta sem nenhuma categoria visível não diz nada — e
    // denunciaria que há coisa privada lá dentro.
    const visible = canEdit
      ? level
      : level.filter((item) => item.kind !== "folder" || (totals.get(item.id)?.categories ?? 0) > 0)
    const base =
      movedAway.length > 0 ? visible.filter((item) => !movedAway.includes(item.id)) : visible
    if (!order) return base
    const byId = new Map(base.map((item) => [item.id, item]))
    const sorted = order.map((id) => byId.get(id)).filter((item) => item !== undefined)
    for (const item of base) {
      if (!order.includes(item.id)) sorted.push(item)
    }
    return sorted
  }, [folders, others, currentFolderId, order, canEdit, totals, movedAway])

  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null
  // Pasta dentro de outra que fecha mais (pública dentro de privada…): na
  // prática vale a de cima — vale avisar o dono.
  const restrictedBy = currentFolder
    ? restrictingAncestor(folders, currentFolder.parent_folder_id, visibilityOf(currentFolder))
    : null

  const trail = useMemo(() => breadcrumbOf(folders, currentFolderId), [folders, currentFolderId])

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Soltou no miolo de uma pasta ou num degrau da trilha: muda de pasta.
    const target = readDropTarget(over.id)
    if (target) {
      const item = items.find((candidate) => candidate.id === String(active.id))
      if (item) await moveTo(item, target.folderId)
      return
    }

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

  /** Leva uma pasta ou categoria deste nível para outra pasta (ou para a raiz). */
  async function moveTo(item: (typeof items)[number], folderId: string | null) {
    if (folderId === currentFolderId) return
    const name = item.kind === "folder" ? item.folder.name : item.category.name
    const destination = folderId ? folders.find((folder) => folder.id === folderId) : null
    if (folderId && !destination) return

    setMovedAway((current) => [...current, item.id])
    const result =
      item.kind === "folder"
        ? await actions.moveFolder({ id: item.id, targetFolderId: folderId })
        : await actions.moveCategory({ id: item.id, targetFolderId: folderId })
    if (!result.ok) {
      setMovedAway((current) => current.filter((id) => id !== item.id))
      toast.error(result.error)
      return
    }
    toast.success(
      destination ? `“${name}” foi para “${destination.name}”.` : `“${name}” foi para as Coleções.`,
      { action: { label: "Abrir", onClick: () => setCurrentFolderId(folderId) } }
    )
  }

  async function toggleFavorite(category: Category) {
    const next = !favoriteSet.has(category.id)
    setFavoritesOptimistic(withFavorite(favorites, category.id, next))
    const result = await actions.setCategoryFavorite({ categoryId: category.id, favorite: next })
    if (!result.ok) {
      setFavoritesOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(
      next ? `“${category.name}” está nos favoritos.` : `“${category.name}” saiu dos favoritos.`
    )
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

  function askDeleteFolder(folder: Folder) {
    const total = totals.get(folder.id)
    setDeleteTarget({
      id: folder.id,
      name: folder.name,
      description:
        total && (total.categories > 0 || total.entries > 0)
          ? `Essa pasta contém ${plural(total.categories, "categoria", "categorias")} e ${itemCount(total.entries)} no total. Tudo vai para a Lixeira, onde dá para restaurar por 30 dias.`
          : "Essa pasta está vazia. Ela vai para a Lixeira por 30 dias.",
    })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const result = await actions.deleteFolder({ id: deleteTarget.id })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const trashId = result.data?.trashId ?? null
    if (trashId) {
      // Apagou sem querer: um toque traz de volta, sem ir até a Lixeira.
      toast.success("Pasta na Lixeira por 30 dias.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            const restored = await restoreTrashAction({ id: trashId })
            if (restored.ok) toast.success("Pasta de volta.")
            else toast.error(restored.error)
          },
        },
      })
    } else {
      toast.success("Pasta excluída.")
    }
    // Apagou a pasta aberta: sobe para a de cima.
    if (deleteTarget.id === currentFolderId) {
      setCurrentFolderId(currentFolder?.parent_folder_id ?? null)
    }
    setDeleteTarget(null)
  }

  const strategy = view === "grid" ? rectSortingStrategy : verticalListSortingStrategy

  return (
    <>
      {top ? <div className="space-y-4 pt-6">{top}</div> : null}

      <PageHeader
        as={top ? "h2" : "h1"}
        label={headerLabel}
        title={headerTitle}
        subtitle={headerSubtitle}
        compact={embedded}
        actions={
          <>
            {filtersHref ? (
              <Link
                href={filtersHref}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <SlidersHorizontal className="size-4" /> Filtros
              </Link>
            ) : null}
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
                      initial: NEW_CATEGORY,
                    })
                  }
                >
                  <Plus className="size-4" /> Nova categoria
                </Button>
              </>
            ) : null}
            <div className="flex items-center gap-1.5">
              <ViewToggle value={view} onChange={changeView} />
              {view === "grid" ? (
                <GridSizeToggle value={gridSize} onChange={changeGridSize} />
              ) : null}
              {/* As favoritas têm a aba delas no perfil: aqui fica só a Lixeira. */}
              {trashCount !== undefined ? (
                <Link
                  href="/lixeira"
                  title="Lixeira"
                  aria-label={trashCount > 0 ? `Lixeira (${trashCount})` : "Lixeira"}
                  className="relative flex size-8 items-center justify-center rounded-md border border-line text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                  {trashCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-brand px-1 text-center text-[0.6rem] leading-4 font-medium text-background">
                      {trashCount > 99 ? "99+" : trashCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
            </div>
          </>
        }
      />

      {searchable ? <CollectionsSearchBar value={query} onChange={setQuery} /> : null}

      {searching ? (
        <CollectionsSearchResults
          query={query}
          folders={folders}
          categories={categories}
          counts={counts}
          onOpenFolder={(folderId) => {
            setQuery("")
            setCurrentFolderId(folderId)
          }}
        />
      ) : (
        // Um só `DndContext` para a trilha e a grade: arrastar um card para um
        // degrau da trilha sobe ele para aquele nível. `id` fixo: sem ele o
        // dnd-kit numera os ids de acessibilidade com um contador global, e o
        // HTML do servidor não bate com o do navegador.
        <DndContext
          id="dnd-colecoes"
          sensors={sensors}
          collisionDetection={moveCollision}
          onDragEnd={onDragEnd}
        >
          <LevelNav
            trail={[
              {
                key: "colecoes",
                label: "Coleções",
                onClick: () => setCurrentFolderId(null),
                ...(canEdit ? { dropLevel: null } : {}),
              },
              ...trail.map((folder) => ({
                key: folder.id,
                label: folder.name,
                onClick: () => setCurrentFolderId(folder.id),
                ...(canEdit ? { dropLevel: folder.id } : {}),
              })),
            ]}
          />

          {/* A pasta aberta: o nome, quem vê e o "⋯" (renomear, excluir). */}
          {canEdit && currentFolder ? (
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="display min-w-0 text-2xl leading-tight [overflow-wrap:anywhere]">
                  {currentFolder.name}
                </h2>
                <PrivacyChip
                  kind="folder"
                  id={currentFolder.id}
                  name={currentFolder.name}
                  visibility={visibilityOf(currentFolder)}
                />
              </div>
              <MoreMenu label={`Mais opções de “${currentFolder.name}”`}>
                <DropdownMenuItem
                  onSelect={() =>
                    setFolderDialog({
                      open: true,
                      folder: { id: currentFolder.id, name: currentFolder.name },
                    })
                  }
                >
                  <Pencil /> Renomear pasta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => askDeleteFolder(currentFolder)}
                >
                  <Trash2 /> Excluir pasta
                </DropdownMenuItem>
              </MoreMenu>
            </div>
          ) : null}

          {canEdit && restrictedBy ? (
            <PrivacyNote>{restrictionNote("folder", restrictedBy)}</PrivacyNote>
          ) : null}

          {/* A "A organizar" só aparece quando tem algo a organizar. */}
          {inbox && currentFolderId === null && (counts[inbox.id] ?? 0) > 0 ? (
            <InboxCard
              category={inbox}
              count={counts[inbox.id] ?? 0}
              href={`/categoria/${inbox.id}`}
              canEdit={canEdit}
            />
          ) : null}

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
                <Button onClick={() => setCategoryEditor({ open: true, initial: NEW_CATEGORY })}>
                  <Plus className="size-4" /> Nova categoria
                </Button>
              }
            />
          ) : (
            <SortableContext items={items.map((item) => item.id)} strategy={strategy}>
              <div
                className={cn(
                  view === "grid" ? cn("grid", GRID_CLASSES[gridSize]) : "flex flex-col gap-2"
                )}
              >
                {items.map((item) =>
                  item.kind === "folder" ? (
                    <CollectionCard
                      key={item.id}
                      id={item.id}
                      kind="folder"
                      name={item.folder.name}
                      visibility={canEdit ? visibilityOf(item.folder) : undefined}
                      icon={null}
                      subtitle={folderSubtitle(item.id)}
                      onOpen={() => setCurrentFolderId(item.id)}
                      sortable={canEdit}
                      view={view}
                      dropInto={canEdit}
                      glyphs={folderGlyphs(folders, others, item.id)}
                    />
                  ) : (
                    <CollectionCard
                      key={item.id}
                      id={item.id}
                      kind="category"
                      name={item.category.name}
                      visibility={canEdit ? visibilityOf(item.category) : undefined}
                      icon={item.category.icon}
                      subtitle={itemCount(counts[item.id] ?? 0)}
                      href={`/categoria/${item.id}`}
                      sortable={canEdit}
                      view={view}
                      cover={covers?.[item.id]}
                      favorite={favoriteSet.has(item.id)}
                      onToggleFavorite={
                        canEdit && favoriteIds !== undefined && canFavorite(item.category)
                          ? () => toggleFavorite(item.category)
                          : undefined
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
                        initial: NEW_CATEGORY,
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
          )}
        </DndContext>
      )}

      {canEdit ? (
        <>
          <FolderDialog
            open={folderDialog.open}
            onOpenChange={(open) => setFolderDialog((state) => ({ ...state, open }))}
            folder={folderDialog.folder}
            scope={{ kind: "collection", parentFolderId: currentFolderId, defaultVisibility }}
          />

          <CategoryEditor
            open={categoryEditor.open}
            onOpenChange={(open) => setCategoryEditor((state) => ({ ...state, open }))}
            initial={categoryEditor.initial}
            folderId={currentFolderId}
            defaultVisibility={defaultVisibility}
          />

          <ConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
            title="Excluir pasta"
            description={deleteTarget?.description ?? ""}
            onConfirm={confirmDelete}
          />
        </>
      ) : null}
    </>
  )
}
