"use client"

import Link from "next/link"
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CheckSquare,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ImageOff,
  Inbox,
  MapIcon,
  Plus,
  SlidersHorizontal,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { CategoryEditor } from "@/components/category/category-editor"
import { DeleteEntryFolderDialog } from "@/components/category/delete-entry-folder-dialog"
import { FilterBar } from "@/components/category/filter-bar"
import { StatsPanel } from "@/components/category/stats-panel"
import { CollectionCard } from "@/components/collection/collection-card"
import { PrivacyNote, PrivacySwitch } from "@/components/collection/privacy-switch"
import { FolderDialog } from "@/components/collection/folder-dialog"
import { MoveDialog } from "@/components/collection/move-dialog"
import { BulkBar } from "@/components/entry/bulk-bar"
import { EntryCard } from "@/components/entry/entry-card"
import { EntryForm } from "@/components/entry/entry-form"
import { EntryRow } from "@/components/entry/entry-row"
import { TierList } from "@/components/entry/tier-list"
import { LinkedBar, type LinkView } from "@/components/explore/linked-bar"
import { BringButton } from "@/components/match/match-marks"
import { MatchPanel } from "@/components/match/match-panel"
import { EmptyState } from "@/components/layout/empty-state"
import { LevelNav, type Crumb } from "@/components/layout/level-nav"
import { PageHeader } from "@/components/layout/page-header"
import { useFolderParam } from "@/components/layout/use-folder-param"
import { useStoredPreference } from "@/components/layout/use-stored-preference"
import type { EntryViewMode } from "@/components/layout/view-toggle"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { applyOrder, breadcrumbOf, foldersOf } from "@/lib/domain/collections"
import { entryFolderTotals, itemsAt, itemsUnder, resolveFolderId } from "@/lib/domain/entry-folders"
import { locationFieldsOf } from "@/lib/domain/fields"
import { DEFAULT_GRID_SIZE, GRID_CLASSES, normalizeGridSize } from "@/lib/domain/grid-size"
import { nextFavorite } from "@/lib/domain/favorites"
import { isInbox } from "@/lib/domain/inbox"
import {
  applyMatchFilter,
  EMPTY_MATCH_FILTER,
  isMatchFilterActive,
  type MatchCopyInfo,
  type MatchFilter,
} from "@/lib/domain/match"
import { quickFieldOf } from "@/lib/domain/quick-field"
import { restrictingAncestor, restrictionNote, visibilityOf } from "@/lib/domain/privacy"
import {
  applyCategoryFilter,
  defaultSortOf,
  isCategoryFilterActive,
  tagsPresentIn,
  type CategoryFilter,
} from "@/lib/domain/filter"
import { itemCount, plural } from "@/lib/domain/format"
import type {
  Category,
  CategorySummary,
  EntryFolder,
  EntryView,
  Folder,
  Profile,
  Tag,
} from "@/lib/domain/types"
import { withFolder } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const VIEW_STORAGE_KEY = "vitrine:categoria:view"
const GRID_STORAGE_KEY = "vitrine:categoria:grade"

function parseView(raw: string | null): EntryViewMode | null {
  return raw === "grid" || raw === "list" || raw === "tier" ? raw : null
}

const MODES_WITH_TIER: EntryViewMode[] = ["grid", "list", "tier"]
const MODES_WITHOUT_TIER: EntryViewMode[] = ["grid", "list"]

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
  initialEditId = null,
  favoriteEntryId = null,
  link = null,
  match = null,
}: {
  category: Category
  owner: Profile | null
  siblings: CategorySummary[]
  views: EntryView[]
  tags: Tag[]
  /** As subpastas desta categoria. */
  entryFolders: EntryFolder[]
  /** As pastas das Coleções do dono — só para a trilha e o Voltar. */
  collectionFolders: Pick<
    Folder,
    "id" | "name" | "parent_folder_id" | "display_order" | "visibility" | "is_public"
  >[]
  /** Onde ficam as Coleções do dono: `/` ou `/v/<username>`. */
  collectionsHref: string
  canEdit: boolean
  initialFilter: CategoryFilter
  initialTab: Tab
  /**
   * `?editar=<id>`: o item que acabou de trocar de categoria chega aqui com o
   * formulário já aberto, para completar os campos daqui.
   */
  initialEditId?: string | null
  /** O favorito da categoria — só vem para o dono. */
  favoriteEntryId?: string | null
  /** Cópia do Explorar: a ligação com a original, já sincronizada (migração 26). */
  link?: LinkView | null
  /**
   * A cópia de um match (migração 31): a legenda, as porcentagens e os filtros
   * rápidos. Os itens já vêm com `view.match`. Nada se edita nos itens (só
   * tags, pasta e excluir, pela seleção); o "Trazer" leva para a A organizar.
   */
  match?: MatchCopyInfo | null
}) {
  const { actions } = useVitrine()
  const matchMode = match !== null
  // Na cópia de um match o dono organiza (pastas, tags, excluir), mas não edita os itens.
  const editItems = canEdit && !matchMode
  const [matchFilter, setMatchFilter] = useState<MatchFilter>(EMPTY_MATCH_FILTER)
  const matchActive = matchMode && isMatchFilterActive(matchFilter)
  const [folderParam, setFolderParam] = useFolderParam()
  const currentFolderId = resolveFolderId(entryFolders, folderParam)

  const [filter, setFilter] = useState<CategoryFilter>(initialFilter)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [storedView, changeView] = useStoredPreference<EntryViewMode>(
    VIEW_STORAGE_KEY,
    "grid",
    parseView
  )
  // Vale para os cards de item e de subpasta desta tela.
  const [gridSize, changeGridSize] = useStoredPreference(
    GRID_STORAGE_KEY,
    DEFAULT_GRID_SIZE,
    normalizeGridSize
  )

  const arrivingEdit =
    canEdit && initialEditId ? (views.find((view) => view.id === initialEditId) ?? null) : null
  const [formOpen, setFormOpen] = useState(arrivingEdit !== null)
  const [editing, setEditing] = useState<EntryView | null>(arrivingEdit)

  // O favorito da categoria: troca na hora (otimista) e volta atrás se o
  // servidor recusar. `undefined` = vale o que veio do servidor.
  const [favoriteOptimistic, setFavoriteOptimistic] = useState<string | null | undefined>(
    undefined
  )
  const favoriteId = favoriteOptimistic === undefined ? favoriteEntryId : favoriteOptimistic

  useEffect(() => {
    setFavoriteOptimistic(undefined)
  }, [favoriteEntryId])

  async function toggleFavorite(item: EntryView) {
    const next = nextFavorite(favoriteId, item.id)
    setFavoriteOptimistic(next)
    const result = await actions.setFavoriteEntry({ categoryId: category.id, entryId: next })
    if (!result.ok) {
      setFavoriteOptimistic(undefined)
      toast.error(result.error)
      return
    }
    toast.success(
      next ? `“${item.name}” é o favorito de “${category.name}”.` : "Favorito desmarcado."
    )
  }

  // O `editar` só vale na chegada: sai da URL para um F5 não reabrir o formulário.
  useEffect(() => {
    if (!initialEditId) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has("editar")) return
    url.searchParams.delete("editar")
    window.history.replaceState(window.history.state, "", url)
  }, [initialEditId])
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

  // Ordem otimista depois de um arraste — some quando o dado novo chega.
  const [folderOrder, setFolderOrder] = useState<string[] | null>(null)
  const [itemOrder, setItemOrder] = useState<string[] | null>(null)

  const defaultSort = defaultSortOf(category)
  const ratingEnabled = category.rating_enabled
  // O tier list nasce da nota: categoria sem estrelas mostra a Grade, mas a
  // preferência salva fica como está (vale de novo numa categoria com notas).
  const view: EntryViewMode = storedView === "tier" && !ratingEnabled ? "grid" : storedView
  const cardView = view === "list" ? "list" : "grid"

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
      set("ordem", filter.sort === defaultSort ? "" : filter.sort)
      set("aba", tab === "itens" ? "" : tab)
      window.history.replaceState(null, "", url.toString())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [filter, tab, defaultSort])

  // Dado novo do servidor (ou outra pasta aberta) manda: a ordem otimista sai.
  useEffect(() => {
    setFolderOrder(null)
  }, [entryFolders, currentFolderId])
  useEffect(() => {
    setItemOrder(null)
  }, [views, currentFolderId])

  // O filtro olha só os itens soltos no nível aberto — subpastas são navegação.
  // Os filtros rápidos do match olham a cópia inteira (cópia antiga, de antes do
  // SQL 32, ainda pode ter subpastas: elas somem enquanto filtra).
  const levelViews = useMemo(
    () => (matchActive ? applyMatchFilter(views, matchFilter) : itemsAt(views, currentFolderId)),
    [views, currentFolderId, matchActive, matchFilter]
  )
  // Subpastas na ordem salva (arrastar); empate, por nome.
  const levelFolders = useMemo(
    () =>
      matchActive ? [] : applyOrder(foldersOf(entryFolders, currentFolderId), folderOrder),
    [entryFolders, currentFolderId, folderOrder, matchActive]
  )
  const totals = useMemo(() => entryFolderTotals(entryFolders, views), [entryFolders, views])
  const active = isCategoryFilterActive(filter)
  const manual = filter.sort === "manual"
  const filtered = useMemo(() => {
    const list = applyCategoryFilter(levelViews, filter)
    return manual && !active ? applyOrder(list, itemOrder) : list
  }, [levelViews, filter, manual, active, itemOrder])
  // A aba Números conta a pasta aberta com todas as subpastas dela.
  const statsBase = useMemo(
    () => applyMatchFilter(itemsUnder(views, entryFolders, currentFolderId), matchFilter),
    [views, entryFolders, currentFolderId, matchFilter]
  )
  const statsViews = useMemo(() => applyCategoryFilter(statsBase, filter), [statsBase, filter])
  const levelTags = useMemo(
    () => tagsPresentIn(tab === "numeros" ? statsBase : levelViews),
    [tab, statsBase, levelViews]
  )

  // Arrastar itens só faz sentido na ordem manual e com o nível inteiro à
  // vista: reordenar um recorte filtrado deixaria ambíguo onde fica o resto.
  // O tier list é só leitura: nada de arrastar nem selecionar ali.
  const isTier = view === "tier"
  const canDragItems =
    editItems && manual && !active && !matchActive && !selecting && !isTier && filtered.length > 1
  const dragStrategy = cardView === "grid" ? rectSortingStrategy : verticalListSortingStrategy

  async function onFolderDragEnd({ active: dragged, over }: DragEndEvent) {
    if (!over || dragged.id === over.id) return
    const ids = levelFolders.map((folder) => folder.id)
    const from = ids.indexOf(String(dragged.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const previous = folderOrder
    const next = arrayMove(ids, from, to)
    setFolderOrder(next)
    const result = await actions.reorderEntryFolders({ categoryId: category.id, ids: next })
    if (!result.ok) {
      setFolderOrder(previous)
      toast.error(result.error)
    }
  }

  async function onItemDragEnd({ active: dragged, over }: DragEndEvent) {
    if (!over || dragged.id === over.id) return
    const ids = filtered.map((item) => item.id)
    const from = ids.indexOf(String(dragged.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const previous = itemOrder
    const next = arrayMove(ids, from, to)
    setItemOrder(next)
    const result = await actions.reorderEntries({ categoryId: category.id, ids: next })
    if (!result.ok) {
      setItemOrder(previous)
      toast.error(result.error)
    }
  }

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

  // O tier list não tem seleção: entrar nele desfaz a que estava aberta.
  function selectView(next: EntryViewMode) {
    if (next === "tier") clearSelection()
    changeView(next)
  }

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

  // O "Trazer": só no que é de outra pessoa; sempre à vista quando é sugestão para você.
  function bringAction(item: EntryView, variant: "card" | "row"): ReactNode {
    if (!canEdit || !item.match || item.match.isMine || selecting) return null
    return (
      <BringButton
        entryId={item.id}
        name={item.name}
        variant={variant}
        // Fora das sugestões, só no hover — e, na lista do celular, só na página do item.
        className={
          item.match.suggestionForMe
            ? undefined
            : variant === "row"
              ? "card-actions hidden sm:inline-flex"
              : "card-actions"
        }
      />
    )
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
    setMatchFilter(EMPTY_MATCH_FILTER)
  }

  // Filtrar a cópia do match junta tudo: a trilha volta para a raiz.
  function changeMatchFilter(next: MatchFilter) {
    setMatchFilter(next)
    if (isMatchFilterActive(next)) setFolderParam(null)
  }

  const deletingParentLabel = (() => {
    if (!deletingFolder) return ""
    const parent = entryFolders.find((folder) => folder.id === deletingFolder.parentId)
    return parent ? `“${parent.name}”` : "a raiz da categoria"
  })()

  const levelIsEmpty = levelViews.length === 0 && levelFolders.length === 0 && !matchActive
  // Categoria dentro de uma pasta que fecha mais (pública dentro de privada…):
  // na prática vale a pasta — vale avisar o dono.
  const visibility = visibilityOf(category)
  const inbox = isInbox(category)
  const restrictedBy = restrictingAncestor(collectionFolders, category.folder_id, visibility)

  return (
    <>
      <PageHeader
        label={
          matchMode
            ? "match · só você vê"
            : owner && !canEdit
              ? `coleção de ${owner.display_name || owner.username}`
              : "sua coleção"
        }
        title={
          <span className="flex items-center gap-2">
            {category.icon ? <span aria-hidden>{category.icon}</span> : null}
            {/* Um @ comprido (o nome da cópia de um match) quebra em qualquer ponto. */}
            <span className="min-w-0 [overflow-wrap:anywhere]">{category.name}</span>
          </span>
        }
        subtitle={
          entryFolders.length > 0
            ? `${itemCount(views.length)} · ${plural(entryFolders.length, "pasta", "pastas")}`
            : itemCount(views.length)
        }
        actions={
          // A cópia de um match é uma lista solta: nada de pasta nem item novo.
          canEdit && matchMode ? null : canEdit ? (
            <>
              <PrivacySwitch
                kind="category"
                id={category.id}
                name={category.name}
                visibility={visibility}
              />
              {/* O Mapa só mostra o que é meu. */}
              {locationFieldsOf(category.estrutura).length > 0 ? (
                <Link
                  href={`/mapa?categoria=${category.id}`}
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <MapIcon className="size-4" /> Ver no mapa
                </Link>
              ) : null}
              {/* A "A organizar" tem estrutura fixa (migração 17). */}
              {inbox ? null : (
                <Button variant="outline" size="lg" onClick={() => setStructureOpen(true)}>
                  <SlidersHorizontal className="size-4" /> Estrutura
                </Button>
              )}
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

      {canEdit && link ? <LinkedBar categoryId={category.id} link={link} /> : null}

      {canEdit && match ? (
        <MatchPanel info={match} filter={matchFilter} onFilterChange={changeMatchFilter} />
      ) : null}

      {canEdit && restrictedBy && !matchMode ? (
        <PrivacyNote>{restrictionNote("category", restrictedBy)}</PrivacyNote>
      ) : null}

      {canEdit && inbox ? (
        <p className="mb-5 flex items-start gap-2 rounded-lg border border-dashed border-brand-dim bg-brand-wash px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Inbox aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand" />
          <span>
            Sua caixa de entrada: o que você salva às pressas cai aqui. Para organizar, marque os
            itens (a caixinha no canto de cada um) e use{" "}
            <span className="text-foreground">Mover</span> para levá-los à categoria certa.
          </span>
        </p>
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
          onViewChange={selectView}
          viewModes={ratingEnabled ? MODES_WITH_TIER : MODES_WITHOUT_TIER}
          gridSize={gridSize}
          onGridSizeChange={changeGridSize}
          active={active}
          ratingEnabled={ratingEnabled}
          showListControls={tab === "itens"}
        />

        {tab === "itens" && levelFolders.length > 0 ? (
          <DndContext
            id="dnd-subpastas"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onFolderDragEnd}
          >
            <SortableContext items={levelFolders.map((folder) => folder.id)} strategy={dragStrategy}>
              <div
                className={cn(
                  cardView === "grid" ? cn("grid", GRID_CLASSES[gridSize]) : "flex flex-col gap-2"
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
                    sortable={canEdit}
                    view={cardView}
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
          <StatsPanel
            views={statsViews}
            estrutura={category.estrutura}
            filterActive={active}
            ratingEnabled={ratingEnabled}
            includesSubfolders={statsBase.length > levelViews.length}
            categoryColor={category.color}
          />
        ) : views.length === 0 && entryFolders.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title="Vitrine vazia"
            description={
              matchMode
                ? "Vocês não têm categorias em comum à vista um do outro — com nomes equivalentes, como Restaurante e Restaurantes."
                : canEdit
                  ? "Nenhum item por aqui ainda. Adicione o primeiro."
                  : "Esta coleção ainda não tem itens."
            }
            action={
              editItems ? (
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
              matchMode
                ? `Nada em “${currentFolder?.name ?? category.name}”. Mova itens para cá pela seleção.`
                : canEdit
                  ? `Nada em “${currentFolder?.name ?? category.name}” ainda. Crie um item aqui ou mova itens para cá pela seleção.`
                  : "Esta pasta ainda não tem itens."
            }
            action={
              editItems ? (
                <Button onClick={openNewEntry}>
                  <Plus className="size-4" /> Novo item
                </Button>
              ) : null
            }
          />
        ) : levelViews.length === 0 && !matchActive ? null : filtered.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title="Nada bateu com o filtro"
            description={
              matchActive
                ? "Nenhum item do match passa por esse recorte."
                : currentFolder
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
                {matchActive
                  ? " no match todo"
                  : levelFolders.length > 0 || currentFolder
                    ? " neste nível"
                    : ""}
              </p>
              {isTier || matchMode ? null : canEdit && manual && active ? (
                <p className="text-xs text-faint">Limpe os filtros para arrastar e reordenar.</p>
              ) : canEdit && canDragItems ? (
                <p className="hidden text-xs text-faint sm:block">
                  Arraste pela alça <GripVertical className="inline size-3" /> para mudar a ordem.
                </p>
              ) : null}
              {canEdit && selecting && !isTier ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(filtered.map((item) => item.id))}
                >
                  <CheckSquare className="size-3.5" /> Selecionar todos (do filtro atual)
                </Button>
              ) : null}
            </div>

            {isTier ? (
              // Fora do DndContext de propósito: nada aqui é arrastável.
              <TierList views={filtered} gridSize={gridSize} categoryColor={category.color} />
            ) : (
              <DndContext
                id="dnd-itens"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onItemDragEnd}
              >
                <SortableContext items={filtered.map((item) => item.id)} strategy={dragStrategy}>
                  <div
                    className={cn(
                      cardView === "grid" ? cn("grid", GRID_CLASSES[gridSize]) : "flex flex-col gap-2",
                      selected.length > 0 && "pb-16"
                    )}
                  >
                    {filtered.map((item, index) => (
                      <SortableEntry key={item.id} id={item.id} disabled={!canDragItems}>
                        {(dragHandle) =>
                          cardView === "grid" ? (
                            <EntryCard
                              view={item}
                              canEdit={editItems}
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
                              dragHandle={dragHandle}
                              compact={gridSize === "small"}
                              favorite={editItems && favoriteId === item.id}
                              onToggleFavorite={editItems ? () => toggleFavorite(item) : undefined}
                              extraAction={bringAction(item, "card")}
                            />
                          ) : (
                            <EntryRow
                              view={item}
                              canEdit={editItems}
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
                              showRating={ratingEnabled}
                              dragHandle={dragHandle}
                              favorite={editItems && favoriteId === item.id}
                              onToggleFavorite={editItems ? () => toggleFavorite(item) : undefined}
                              extraAction={bringAction(item, "row")}
                            />
                          )
                        }
                      </SortableEntry>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      {editItems ? (
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
            ratingEnabled={ratingEnabled}
            categories={siblings}
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
              ratingEnabled,
              defaultSort,
              quickField: quickFieldOf(category),
            }}
          />
        </>
      ) : null}

      {canEdit ? (
        <>
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
              allowCategoryMove={!matchMode}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

/**
 * Um item arrastável. A alça vai junto das ações do card (só aparece quando
 * dá para arrastar); o resto do card continua sendo o link para o item.
 */
function SortableEntry({
  id,
  disabled,
  children,
}: {
  id: string
  disabled: boolean
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  const handle = disabled ? null : (
    <button
      type="button"
      {...attributes}
      {...listeners}
      title="Arrastar para reordenar"
      aria-label="Arrastar para reordenar"
      className="cursor-grab touch-none rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "relative z-30 opacity-90")}
    >
      {children(handle)}
    </div>
  )
}
