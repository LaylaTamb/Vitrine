"use client"

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Filter, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { EntryCard } from "@/components/entry/entry-card"
import { GlobalFilterSidebar } from "@/components/filter/global-filter-sidebar"
import { useGlobalFilter } from "@/components/filter/use-global-filter"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { groupByCategory, sortDirLabel } from "@/lib/domain/filter"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, EntryView, Tag } from "@/lib/domain/types"

const GROUP_STORAGE_KEY = "vitrine:filtro:agrupar"

/**
 * `/filtro` — cruza todas as categorias de uma vez.
 *
 * O estado do filtro (`useGlobalFilter`) e a barra lateral
 * (`GlobalFilterSidebar`) são os mesmos do Mapa; aqui ficam só a ordenação
 * visível e o resultado em cards.
 */
export function GlobalFilterView({
  categories,
  views,
  tags,
}: {
  categories: Category[]
  views: EntryView[]
  tags: Tag[]
}) {
  const state = useGlobalFilter(categories, views)
  const { filter, sortOptions, sortOption, sortDir, filtered, active, ruleCount, clearAll } = state
  const [grouped, setGrouped] = useState(true)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROUP_STORAGE_KEY)
      if (stored === "0") setGrouped(false)
    } catch {
      // storage bloqueado: segue agrupado
    }
  }, [])

  function changeGrouped(next: boolean) {
    setGrouped(next)
    try {
      window.localStorage.setItem(GROUP_STORAGE_KEY, next ? "1" : "0")
    } catch {
      // idem
    }
  }

  const groups = useMemo(() => groupByCategory(filtered, categories), [filtered, categories])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const labelOf = (categoryId: string) => {
    const category = categoryById.get(categoryId)
    return category ? `${category.icon ? `${category.icon} ` : ""}${category.name}` : ""
  }

  return (
    <>
      <PageHeader
        label="Acervo inteiro"
        title="Filtro geral"
        subtitle={
          active
            ? `${itemCount(filtered.length)} em ${plural(groups.length, "categoria", "categorias")}`
            : `${itemCount(views.length)} em ${plural(categories.length, "categoria", "categorias")}`
        }
        actions={
          active ? (
            <Button variant="outline" size="lg" onClick={clearAll}>
              <X className="size-4" /> Limpar tudo
            </Button>
          ) : null
        }
      />

      {/* `lg:overflow-y-auto` + `max-h` separam a rolagem da barra lateral da
          rolagem dos itens — sem isso os dois se moviam juntos, e uma barra
          lateral alta empurrava os itens pra fora da tela. */}
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
        <aside className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          <GlobalFilterSidebar state={state} categories={categories} tags={tags} />
        </aside>

        <section className="min-w-0 space-y-6">
          {views.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Label htmlFor="global-sort" className="plaque shrink-0">
                  Ordenar por
                </Label>
                <select
                  id="global-sort"
                  value={sortOption.value}
                  onChange={(event) => state.changeSort(event.target.value)}
                  className="h-8 max-w-56 rounded-md border border-line bg-bg-soft px-2 text-sm outline-none focus-visible:border-brand-dim"
                >
                  <optgroup label="Geral">
                    {sortOptions.slice(0, 3).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  {sortOptions.length > 3 ? (
                    <optgroup label="Campos">
                      {sortOptions.slice(3).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={state.toggleSortDir}
                  aria-label={`Inverter ordem (agora: ${sortDirLabel(sortOption.kind, sortDir)})`}
                >
                  {sortDir === "asc" ? (
                    <ArrowUpNarrowWide className="size-3.5" />
                  ) : (
                    <ArrowDownWideNarrow className="size-3.5" />
                  )}
                  {sortDirLabel(sortOption.kind, sortDir)}
                </Button>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={grouped} onCheckedChange={(value) => changeGrouped(value === true)} />
                Agrupar por categoria
              </label>
            </div>
          ) : null}

          {views.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="Acervo vazio"
              description="Crie categorias e itens para ter o que cruzar aqui."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="Nada bateu com o filtro"
              description={
                filter.mode === "and" && ruleCount > 1
                  ? "Nenhum item passa por todas as regras juntas. Experimente o modo OU."
                  : "Nenhum item do seu acervo passa por esse recorte."
              }
              action={
                <Button variant="outline" onClick={clearAll}>
                  Limpar tudo
                </Button>
              }
            />
          ) : grouped ? (
            groups.map((group) => (
              <div key={group.categoryId} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-line pb-2">
                  {group.icon ? <span aria-hidden>{group.icon}</span> : null}
                  <h2 className="display text-lg">{group.categoryName}</h2>
                  <span className="text-xs text-faint">{itemCount(group.views.length)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.views.map((item) => (
                    <EntryCard key={item.id} view={item} canEdit={false} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item) => (
                <EntryCard
                  key={item.id}
                  view={item}
                  canEdit={false}
                  categoryLabel={labelOf(item.categoryId)}
                  categoryColor={categoryById.get(item.categoryId)?.color}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
