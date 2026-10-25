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
import Link from "next/link"
import { ArrowLeft, Star } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { CollectionCard } from "@/components/collection/collection-card"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useVitrine } from "@/components/providers/vitrine-context"
import { breadcrumbOf } from "@/lib/domain/collections"
import { tabCategories, withFavorite } from "@/lib/domain/favorites"
import { itemCount } from "@/lib/domain/format"
import { DEFAULT_GRID_SIZE, GRID_CLASSES } from "@/lib/domain/grid-size"
import { visibilityOf } from "@/lib/domain/privacy"
import type { Category, Folder } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * As favoritas: só as categorias com a estrela, juntas — cada uma continua na
 * pasta dela (o card diz onde). Um toque abre a categoria; arrastar ordena;
 * a estrela tira dos favoritos (não apaga nada). Só a própria pessoa vê.
 */
export function FavoritesView({
  ready,
  order: savedOrder,
  categories,
  folders,
  counts,
  covers,
  embedded = false,
}: {
  /** `false` = a migração 20 ainda não rodou. */
  ready: boolean
  /** Os ids das favoritas, na ordem. */
  order: string[]
  /** Todas as categorias da pessoa. */
  categories: Category[]
  /** As pastas — para dizer onde cada favorita mora. */
  folders: Folder[]
  counts: Record<string, number>
  /** category_id → até 3 fotos para a capa (migração 40). */
  covers?: Record<string, string[]>
  /** Dentro da aba Favoritas do Perfil: sem o título e sem o "← Coleções". */
  embedded?: boolean
}) {
  const { actions } = useVitrine()
  // A ordem otimista — some quando o dado novo chega.
  const [order, setOrder] = useState<string[] | null>(null)

  useEffect(() => {
    setOrder(null)
  }, [savedOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const current = order ?? savedOrder
  const favorites = useMemo(() => tabCategories(current, categories), [current, categories])
  const ids = favorites.map((category) => category.id)

  function whereIs(category: Category): string {
    const trail = breadcrumbOf(folders, category.folder_id)
    const place = trail.length > 0 ? trail.map((folder) => folder.name).join(" › ") : "Coleções"
    return `${itemCount(counts[category.id] ?? 0)} · ${place}`
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const previous = order
    setOrder(arrayMove(ids, from, to))
    const result = await actions.setFavoritesTab({ categoryIds: arrayMove(ids, from, to) })
    if (!result.ok) {
      setOrder(previous)
      toast.error(result.error)
    }
  }

  async function unfavorite(category: Category) {
    const previous = order
    setOrder(withFavorite(ids, category.id, false))
    const result = await actions.setCategoryFavorite({ categoryId: category.id, favorite: false })
    if (!result.ok) {
      setOrder(previous)
      toast.error(result.error)
      return
    }
    toast.success(`“${category.name}” saiu dos favoritos. Continua na pasta dela.`)
  }

  const back = embedded ? null : (
    <Link
      href="/perfil"
      className="mb-5 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> Coleções
    </Link>
  )

  if (!ready) {
    return (
      <>
        <PageHeader label="Coleções" title="Favoritos" compact={embedded} />
        {back}
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
        label="Coleções"
        title="Favoritos"
        compact={embedded}
        subtitle={
          favorites.length > 1
            ? "As categorias com a estrela, sem sair das pastas delas. Arraste para ordenar."
            : "As categorias com a estrela, sem sair das pastas delas."
        }
      />
      {back}

      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma categoria favorita"
          description="Toque na estrela de uma categoria — no card, nas Coleções, ou no topo dela — e ela aparece aqui, sem sair da pasta."
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
              {favorites.map((category) => (
                <CollectionCard
                  key={category.id}
                  id={category.id}
                  kind="category"
                  name={category.name}
                  icon={category.icon}
                  subtitle={whereIs(category)}
                  href={`/categoria/${category.id}`}
                  sortable={favorites.length > 1}
                  view="grid"
                  visibility={visibilityOf(category)}
                  cover={covers?.[category.id]}
                  favorite
                  onToggleFavorite={() => unfavorite(category)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  )
}
