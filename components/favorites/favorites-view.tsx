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
} from "@dnd-kit/sortable"
import { Plus, Search, Star } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { CollectionCard } from "@/components/collection/collection-card"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { addableCategories, tabCategories } from "@/lib/domain/favorites"
import { itemCount } from "@/lib/domain/format"
import { DEFAULT_GRID_SIZE, GRID_CLASSES } from "@/lib/domain/grid-size"
import { visibilityOf } from "@/lib/domain/privacy"
import { normalizeCategoryName } from "@/lib/domain/templates"
import type { Category } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * A aba Favoritos: as categorias que a pessoa escolheu, inteiras, como nas
 * Coleções — um toque abre a categoria. "Adicionar categoria" põe mais;
 * arrastar ordena; o X tira (não apaga nada). A estrelinha de um item é outra
 * coisa: só marca o item preferido dentro da categoria, e não aparece aqui.
 * Só a própria pessoa vê.
 */
export function FavoritesView({
  ready,
  order: savedOrder,
  categories,
  counts,
}: {
  /** `false` = a migração 20 ainda não rodou. */
  ready: boolean
  /** Os ids das categorias da aba, na ordem. */
  order: string[]
  /** Todas as categorias da pessoa. */
  categories: Category[]
  counts: Record<string, number>
}) {
  const { actions } = useVitrine()
  const [adding, setAdding] = useState(false)
  // A ordem otimista — some quando o dado novo chega.
  const [order, setOrder] = useState<string[] | null>(null)

  useEffect(() => {
    setOrder(null)
  }, [savedOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tab = order ?? savedOrder
  const inTab = useMemo(() => tabCategories(tab, categories), [tab, categories])
  const addable = useMemo(() => addableCategories(tab, categories), [tab, categories])
  const ids = inTab.map((category) => category.id)

  async function save(next: string[]): Promise<boolean> {
    const previous = order
    setOrder(next)
    const result = await actions.setFavoritesTab({ categoryIds: next })
    if (!result.ok) {
      setOrder(previous)
      toast.error(result.error)
      return false
    }
    return true
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void save(arrayMove(ids, from, to))
  }

  async function add(category: Category) {
    if (await save([...ids, category.id])) toast.success(`“${category.name}” está nos Favoritos.`)
  }

  async function remove(category: Category) {
    if (await save(ids.filter((id) => id !== category.id))) {
      toast.success(`“${category.name}” saiu dos Favoritos. A categoria continua nas Coleções.`)
    }
  }

  if (!ready) {
    return (
      <>
        <PageHeader label="Só você vê" title="Favoritos" />
        <EmptyState
          icon={Star}
          title="Os favoritos ainda não estão no banco"
          description="Rode supabase/20_favorites.sql no SQL Editor do Supabase."
        />
      </>
    )
  }

  const addButton = (
    <Button size="lg" onClick={() => setAdding(true)} disabled={addable.length === 0}>
      <Plus className="size-4" /> Adicionar categoria
    </Button>
  )

  return (
    <>
      <PageHeader
        label="Só você vê"
        title="Favoritos"
        subtitle={
          inTab.length > 1
            ? "As suas categorias preferidas, num lugar só. Arraste para ordenar."
            : "As suas categorias preferidas, num lugar só."
        }
        actions={addButton}
      />

      {inTab.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma categoria nos Favoritos"
          description={
            addable.length === 0
              ? "Crie uma categoria nas Coleções para poder pôr aqui."
              : "Adicione as categorias que você mais abre: elas ficam aqui, à mão."
          }
          action={addable.length === 0 ? undefined : addButton}
        />
      ) : (
        <DndContext
          id="dnd-favoritos"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className={cn("grid pb-16", GRID_CLASSES[DEFAULT_GRID_SIZE])}>
              {inTab.map((category) => (
                <CollectionCard
                  key={category.id}
                  id={category.id}
                  kind="category"
                  name={category.name}
                  icon={category.icon}
                  subtitle={itemCount(counts[category.id] ?? 0)}
                  href={`/categoria/${category.id}`}
                  canEdit
                  sortable={inTab.length > 1}
                  view="grid"
                  visibility={visibilityOf(category)}
                  onRemove={() => remove(category)}
                  removeLabel={`Tirar ${category.name} dos Favoritos`}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddCategoryDialog
        open={adding}
        onOpenChange={setAdding}
        categories={addable}
        counts={counts}
        onAdd={add}
      />
    </>
  )
}

/** Escolher categorias para a aba: um toque adiciona; a lista fica aberta para mais. */
function AddCategoryDialog({
  open,
  onOpenChange,
  categories,
  counts,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  counts: Record<string, number>
  onAdd: (category: Category) => void
}) {
  const [query, setQuery] = useState("")
  const key = normalizeCategoryName(query)
  const shown = key
    ? categories.filter((category) => normalizeCategoryName(category.name).includes(key))
    : categories

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("")
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">Adicionar categoria</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Toque numa categoria para pôr nos Favoritos.
          </DialogDescription>
        </DialogHeader>

        {categories.length > 6 ? (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar categoria…"
              aria-label="Buscar categoria"
              className="pl-8"
            />
          </div>
        ) : null}

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas as suas categorias já estão aqui.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria com esse nome.</p>
        ) : (
          <ul className="-mx-1 max-h-80 space-y-1 overflow-y-auto px-1">
            {shown.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => onAdd(category)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-brand-dim hover:bg-surface-hi"
                >
                  <span aria-hidden className="w-6 shrink-0 text-center">
                    {category.icon || "📁"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {category.name}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {itemCount(counts[category.id] ?? 0)}
                  </span>
                  <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Pronto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
