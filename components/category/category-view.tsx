"use client"

import Link from "next/link"
import { CheckSquare, ImageOff, Plus, SlidersHorizontal } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { deleteEntryAction } from "@/app/categoria/[categoryId]/actions"
import { CategoryEditor } from "@/components/category/category-editor"
import { FilterBar } from "@/components/category/filter-bar"
import { StatsPanel } from "@/components/category/stats-panel"
import { BulkBar } from "@/components/entry/bulk-bar"
import { EntryCard } from "@/components/entry/entry-card"
import { EntryForm } from "@/components/entry/entry-form"
import { EntryRow } from "@/components/entry/entry-row"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import type { ViewMode } from "@/components/layout/view-toggle"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  applyCategoryFilter,
  isCategoryFilterActive,
  tagsPresentIn,
  type CategoryFilter,
} from "@/lib/domain/filter"
import { itemCount } from "@/lib/domain/format"
import type { Category, EntryView, Profile, Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

const VIEW_STORAGE_KEY = "vitrine:categoria:view"

type Tab = "itens" | "numeros"

export function CategoryView({
  category,
  owner,
  siblings,
  views,
  tags,
  canEdit,
  initialFilter,
  initialTab,
}: {
  category: Category
  owner: Profile | null
  siblings: Pick<Category, "id" | "name" | "icon" | "display_order">[]
  views: EntryView[]
  tags: Tag[]
  canEdit: boolean
  initialFilter: CategoryFilter
  initialTab: Tab
}) {
  const [filter, setFilter] = useState<CategoryFilter>(initialFilter)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [view, setView] = useState<ViewMode>("grid")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EntryView | null>(null)
  const [structureOpen, setStructureOpen] = useState(false)
  const [deleting, setDeleting] = useState<EntryView | null>(null)

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
   * v1 em outra roupa.
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
      set("ordem", filter.sort === "recent" ? "" : filter.sort)
      set("aba", tab === "itens" ? "" : tab)
      window.history.replaceState(null, "", url.toString())
    }, 400)
    return () => window.clearTimeout(timer)
  }, [filter, tab])

  const filtered = useMemo(() => applyCategoryFilter(views, filter), [views, filter])
  const active = isCategoryFilterActive(filter)
  const categoryTags = useMemo(() => tagsPresentIn(views), [views])

  const clearSelection = useCallback(() => {
    setSelected([])
    setSelecting(false)
    setLastIndex(null)
  }, [])

  // Item que saiu do recorte não pode continuar selecionado.
  useEffect(() => {
    setSelected((current) => current.filter((id) => filtered.some((item) => item.id === id)))
  }, [filtered])

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
    const result = await deleteEntryAction({ id: deleting.id, categoryId: category.id })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Item excluído.")
    setDeleting(null)
  }

  const countLabel = active
    ? `${filtered.length} de ${itemCount(views.length)}`
    : itemCount(views.length)

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
        subtitle={countLabel}
        actions={
          canEdit ? (
            <>
              <Button variant="outline" size="lg" onClick={() => setStructureOpen(true)}>
                <SlidersHorizontal className="size-4" /> Estrutura
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" /> Novo item
              </Button>
            </>
          ) : null
        }
      />

      {siblings.length > 1 ? (
        <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {siblings.map((sibling) => (
            <Link
              key={sibling.id}
              href={`/categoria/${sibling.id}`}
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
          onClear={() => setFilter({ ...initialFilter, query: "", minRating: "", maxRating: "", tagIds: [] })}
          tags={categoryTags}
          view={view}
          onViewChange={changeView}
          active={active}
        />

        {tab === "numeros" ? (
          <StatsPanel views={filtered} estrutura={category.estrutura} filterActive={active} />
        ) : views.length === 0 ? (
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
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="size-4" /> Novo item
                </Button>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title="Nada bateu com o filtro"
            description="Nenhum item do acervo passa por esse recorte."
            action={
              <Button
                variant="outline"
                onClick={() =>
                  setFilter({
                    ...filter,
                    query: "",
                    minRating: "",
                    maxRating: "",
                    tagIds: [],
                  })
                }
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {active ? `${filtered.length} de ${itemCount(views.length)}` : itemCount(views.length)}
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
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
