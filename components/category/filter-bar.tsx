"use client"

import { Search, X } from "lucide-react"

import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ViewToggle, type ViewMode } from "@/components/layout/view-toggle"
import { SORT_OPTIONS, type CategoryFilter, type SortKey } from "@/lib/domain/filter"
import type { Tag } from "@/lib/domain/types"

/**
 * A barra de filtros. Tudo aqui é memória do cliente: digitar não dispara
 * requisição nenhuma.
 */
export function FilterBar({
  filter,
  onChange,
  onClear,
  tags,
  view,
  onViewChange,
  active,
}: {
  filter: CategoryFilter
  onChange: (filter: CategoryFilter) => void
  onClear: () => void
  tags: Tag[]
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  active: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={filter.query}
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
            placeholder="Buscar por nome, tag ou campo…"
            className="pl-8"
            aria-label="Buscar"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="plaque hidden sm:inline">Nota</span>
          <Input
            type="number"
            min={0}
            max={5}
            step={0.5}
            value={filter.minRating}
            onChange={(event) => onChange({ ...filter, minRating: event.target.value })}
            placeholder="mín"
            aria-label="Nota mínima"
            className="w-20"
          />
          <span className="text-faint">–</span>
          <Input
            type="number"
            min={0}
            max={5}
            step={0.5}
            value={filter.maxRating}
            onChange={(event) => onChange({ ...filter, maxRating: event.target.value })}
            placeholder="máx"
            aria-label="Nota máxima"
            className="w-20"
          />
        </div>

        <select
          value={filter.sort}
          onChange={(event) => onChange({ ...filter, sort: event.target.value as SortKey })}
          aria-label="Ordenar por"
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ViewToggle value={view} onChange={onViewChange} />

        {active ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="size-3.5" /> Limpar
          </Button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagPill
              key={tag.id}
              tag={tag}
              active={filter.tagIds.includes(tag.id)}
              onClick={() =>
                onChange({
                  ...filter,
                  tagIds: filter.tagIds.includes(tag.id)
                    ? filter.tagIds.filter((id) => id !== tag.id)
                    : [...filter.tagIds, tag.id],
                })
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
