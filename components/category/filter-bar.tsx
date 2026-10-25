"use client"

import { Search, SlidersHorizontal, X } from "lucide-react"
import { useState } from "react"

import { MatchModeToggle } from "@/components/filter/match-mode-toggle"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { GridSizeToggle } from "@/components/layout/grid-size-toggle"
import { ViewToggle, type EntryViewMode } from "@/components/layout/view-toggle"
import { sortOptionsFor, type CategoryFilter, type SortKey } from "@/lib/domain/filter"
import { itemCount } from "@/lib/domain/format"
import type { GridSize } from "@/lib/domain/grid-size"
import type { Tag } from "@/lib/domain/types"

/**
 * A barra de filtros: a busca e o modo de exibição à vista; nota, ordem e tags
 * num painel atrás do botão Filtros (de baixo para cima, no celular). Tudo
 * aqui é memória do cliente: digitar não dispara requisição nenhuma.
 */
export function FilterBar({
  filter,
  onChange,
  onClear,
  tags,
  view,
  onViewChange,
  viewModes,
  gridSize,
  onGridSizeChange,
  active,
  resultCount,
  ratingEnabled = true,
  showListControls = true,
}: {
  filter: CategoryFilter
  onChange: (filter: CategoryFilter) => void
  onClear: () => void
  tags: Tag[]
  view: EntryViewMode
  onViewChange: (view: EntryViewMode) => void
  /** Os modos que esta categoria oferece — o tier list só com estrelas. */
  viewModes: EntryViewMode[]
  /** Tamanho dos cards (e das miniaturas do tier list) — some no modo Lista. */
  gridSize: GridSize
  onGridSizeChange: (size: GridSize) => void
  active: boolean
  /** Quantos itens passam pelo filtro agora — o "Ver N itens" do painel. */
  resultCount: number
  /** Categoria sem estrelas: some a faixa de nota e as ordenações por nota. */
  ratingEnabled?: boolean
  /** `false` na aba Números: ordem, modo de exibição e tamanho não mudam nada lá. */
  showListControls?: boolean
}) {
  const [open, setOpen] = useState(false)
  // O número no botão: a faixa de nota conta como uma regra; cada tag, outra.
  const rules = (filter.minRating.trim() || filter.maxRating.trim() ? 1 : 0) + filter.tagIds.length
  const hasPanel = ratingEnabled || showListControls || tags.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          placeholder="Buscar por nome, tag ou campo…"
          className="pl-8"
          aria-label="Buscar"
        />
      </div>

      {hasPanel ? (
        <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" /> Filtros
          {rules > 0 ? (
            <span className="min-w-4 rounded-full bg-brand px-1 text-center text-[0.65rem] leading-4 font-medium text-background">
              {rules}
            </span>
          ) : null}
        </Button>
      ) : null}

      {showListControls ? (
        <div className="flex items-center gap-1.5">
          <ViewToggle value={view} onChange={onViewChange} modes={viewModes} />
          {view !== "list" ? <GridSizeToggle value={gridSize} onChange={onGridSizeChange} /> : null}
        </div>
      ) : null}

      {active ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" /> Limpar
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-2xl">Filtros</DialogTitle>
            <DialogDescription>Só nesta categoria.</DialogDescription>
          </DialogHeader>

          {ratingEnabled ? (
            <section className="space-y-2">
              <p className="plaque">Nota</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={filter.minRating}
                  onChange={(event) => onChange({ ...filter, minRating: event.target.value })}
                  placeholder="mínima"
                  aria-label="Nota mínima"
                />
                <span className="text-faint">–</span>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={filter.maxRating}
                  onChange={(event) => onChange({ ...filter, maxRating: event.target.value })}
                  placeholder="máxima"
                  aria-label="Nota máxima"
                />
              </div>
            </section>
          ) : null}

          {showListControls ? (
            <section className="space-y-2">
              <p className="plaque">Ordem</p>
              <select
                value={filter.sort}
                onChange={(event) => onChange({ ...filter, sort: event.target.value as SortKey })}
                aria-label="Ordenar por"
                className="h-9 w-full rounded-xl border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
              >
                {sortOptionsFor(ratingEnabled).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="plaque">Tags</p>
                {tags.length > 1 ? (
                  <MatchModeToggle
                    value={filter.mode}
                    onChange={(mode) => onChange({ ...filter, mode })}
                  />
                ) : null}
              </div>
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
            </section>
          ) : null}

          <div className="flex gap-2">
            {rules > 0 ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onChange({ ...filter, minRating: "", maxRating: "", tagIds: [] })}
              >
                Limpar
              </Button>
            ) : null}
            <Button size="lg" className="flex-1" onClick={() => setOpen(false)}>
              Ver {itemCount(resultCount)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
