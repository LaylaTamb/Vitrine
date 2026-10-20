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
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, GripVertical, Pencil, Star, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { EntryCard } from "@/components/entry/entry-card"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { favoritesTabItems, tabOrder, type FavoriteRow } from "@/lib/domain/favorites"
import type { Category, EntryWithTags, Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"
import { cn } from "@/lib/utils"

const ADD = "__adicionar__"

/**
 * A aba Favoritos: o favorito de cada categoria que a pessoa pôs na aba, na
 * ordem dela. Categoria sem favorito não aparece — só no modo "Editar aba",
 * onde se adiciona, tira e arrasta para ordenar (cada mudança grava na hora).
 * Só a própria pessoa vê.
 */
export function FavoritesView({
  ready,
  rows,
  categories,
  entries,
  tags,
}: {
  /** `false` = a migração 20 ainda não rodou. */
  ready: boolean
  rows: FavoriteRow[]
  /** Todas as categorias da pessoa. */
  categories: Category[]
  /** Os itens favoritos. */
  entries: EntryWithTags[]
  tags: Tag[]
}) {
  const { actions, basePath } = useVitrine()
  const [editing, setEditing] = useState(false)
  // A ordem otimista da aba — some quando o dado novo chega.
  const [order, setOrder] = useState<string[] | null>(null)

  useEffect(() => {
    setOrder(null)
  }, [rows])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tab = useMemo(() => order ?? tabOrder(rows), [order, rows])
  const tabRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        tab_position: tab.includes(row.category_id) ? tab.indexOf(row.category_id) : null,
      })),
    [rows, tab]
  )
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const favoriteByCategory = useMemo(
    () => new Map(rows.map((row) => [row.category_id, row.entry_id])),
    [rows]
  )

  const items = useMemo(() => {
    const tagsById = new Map(tags.map((tag) => [tag.id, tag]))
    return favoritesTabItems(tabRows, categories, entries).map(({ category, entry }) => ({
      category,
      view: toView(entry, category.estrutura, tagsById, category.name, basePath),
    }))
  }, [tabRows, categories, entries, tags, basePath])

  const inTab = tab
    .map((id) => categoryById.get(id))
    .filter((category): category is Category => category !== undefined)
  const outOfTab = categories.filter((category) => !tab.includes(category.id))

  async function save(next: string[]) {
    const previous = order
    setOrder(next)
    const result = await actions.setFavoritesTab({ categoryIds: next })
    if (!result.ok) {
      setOrder(previous)
      toast.error(result.error)
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = tab.indexOf(String(active.id))
    const to = tab.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    void save(arrayMove(tab, from, to))
  }

  function favoriteLabel(categoryId: string): string | null {
    const entryId = favoriteByCategory.get(categoryId)
    const entry = entryId ? entryById.get(entryId) : undefined
    return entry && entry.category_id === categoryId ? entry.name : null
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

  return (
    <>
      <PageHeader
        label="Só você vê"
        title="Favoritos"
        subtitle="O favorito de cada categoria que você escolheu para esta aba."
        actions={
          <Button
            variant={editing ? "default" : "outline"}
            size="lg"
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? (
              <>
                <Check className="size-4" /> Concluir
              </>
            ) : (
              <>
                <Pencil className="size-4" /> Editar aba
              </>
            )}
          </Button>
        }
      />

      {editing ? (
        <section className="mb-8 max-w-[40rem] space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="space-y-1">
            <p className="plaque">Editar aba</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Escolha as categorias e arraste para ordenar. Categoria sem favorito fica guardada
              aqui, mas só aparece na aba quando você marcar a estrela de um item dela.
            </p>
          </div>

          {inTab.length > 0 ? (
            <DndContext
              id="dnd-favoritos"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={tab} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {inTab.map((category) => (
                    <TabRow
                      key={category.id}
                      category={category}
                      favorite={favoriteLabel(category.id)}
                      onRemove={() => save(tab.filter((id) => id !== category.id))}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-faint">Nenhuma categoria na aba ainda.</p>
          )}

          {outOfTab.length > 0 ? (
            <select
              aria-label="Adicionar categoria à aba"
              value={ADD}
              onChange={(event) => {
                if (event.target.value !== ADD) void save([...tab, event.target.value])
              }}
              className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim sm:max-w-xs"
            >
              <option value={ADD}>+ Adicionar categoria…</option>
              {outOfTab.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title={inTab.length === 0 ? "Sua aba Favoritos está vazia" : "Nenhum favorito por aqui"}
          description={
            inTab.length === 0
              ? "Marque a estrela de um item — o favorito da categoria — e escolha em “Editar aba” quais categorias aparecem aqui."
              : "As categorias da aba ainda não têm favorito. Marque a estrela de um item numa delas."
          }
          action={
            editing ? undefined : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Editar aba
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ category, view }) => (
            <EntryCard
              key={category.id}
              view={view}
              canEdit={false}
              categoryColor={category.color}
              categoryLabel={`${category.icon ? `${category.icon} ` : ""}${category.name}`}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Uma categoria no "Editar aba": alça, nome, o favorito (ou o aviso) e tirar. */
function TabRow({
  category,
  favorite,
  onRemove,
}: {
  category: Category
  favorite: string | null
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-2 py-1.5",
        isDragging && "z-10 border-line-hi opacity-90"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${category.name}`}
        className="cursor-grab touch-none rounded p-1 text-faint hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span aria-hidden className="w-6 shrink-0 text-center">
        {category.icon ?? ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{category.name}</span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {favorite ? (
            <>
              <Star aria-hidden className="size-3 shrink-0 fill-current text-brand" />
              <span className="truncate">{favorite}</span>
            </>
          ) : (
            <span className="truncate text-faint">Sem favorito — não aparece na aba</span>
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Tirar ${category.name} da aba`}
        title="Tirar da aba"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-danger"
      >
        <X className="size-3.5" />
      </button>
    </li>
  )
}
