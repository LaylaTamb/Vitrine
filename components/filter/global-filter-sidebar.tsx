"use client"

import { Search, X } from "lucide-react"

import { MatchModeToggle } from "@/components/filter/match-mode-toggle"
import type { GlobalFilterState } from "@/components/filter/use-global-filter"
import { TagPill } from "@/components/tag/tag-pill"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isNumericField } from "@/lib/domain/fields"
import { plural } from "@/lib/domain/format"
import {
  EMPTY_FIELD_FILTER,
  isFieldFilterActive,
  type FieldFilter,
  type UnifiedField,
} from "@/lib/domain/filter"
import type { Category, Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * A barra lateral do filtro geral: "Sempre valem" (nome, nota, categorias) e
 * "Tags e campos". Só o conteúdo — quem usa decide o `<aside>` em volta
 * (fixo na rolagem no `/filtro`, recolhível no Mapa).
 */
export function GlobalFilterSidebar({
  state,
  categories,
  tags,
  categoryCounts,
  showRating = true,
}: {
  state: GlobalFilterState
  categories: Category[]
  tags: Tag[]
  /** Um número ao lado de cada categoria (os lugares no Mapa). */
  categoryCounts?: Record<string, number>
  /** `false` quando nenhuma das categorias usa estrelas: o filtro de nota some. */
  showRating?: boolean
}) {
  const { filter, unified, activeFields, availableFields, ruleCount } = state

  return (
    <>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <p className="plaque">Sempre valem</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={filter.query}
            onChange={(event) => state.setQuery(event.target.value)}
            placeholder="Nome do item"
            aria-label="Nome do item"
            className="pl-8"
          />
        </div>

        {showRating ? (
          <div className="flex items-center gap-1.5">
            <span className="plaque shrink-0">Nota</span>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={filter.minRating}
              onChange={(event) => state.setMinRating(event.target.value)}
              placeholder="mín"
              aria-label="Nota mínima"
            />
            <span className="text-faint">–</span>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={filter.maxRating}
              onChange={(event) => state.setMaxRating(event.target.value)}
              placeholder="máx"
              aria-label="Nota máxima"
            />
          </div>
        ) : null}

        {categories.length > 1 ? (
          <div className="space-y-1.5 pt-1">
            <span className="plaque block">Categorias</span>
            <div className="space-y-1">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={filter.categoryIds.includes(category.id)}
                    onCheckedChange={() => state.toggleCategory(category.id)}
                  />
                  {category.icon ? <span aria-hidden>{category.icon}</span> : null}
                  <span className="truncate">{category.name}</span>
                  {categoryCounts ? (
                    <span
                      className="ml-auto shrink-0 text-xs tabular-nums text-faint"
                      title={plural(categoryCounts[category.id] ?? 0, "lugar no mapa", "lugares no mapa")}
                    >
                      {categoryCounts[category.id] ?? 0}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {tags.length > 0 || unified.length > 0 ? (
        <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div className="space-y-2">
            <p className="plaque">Tags e campos</p>
            <MatchModeToggle value={filter.mode} onChange={state.setMode} />
            {ruleCount > 1 ? (
              <p className="text-[0.68rem] leading-relaxed text-faint">
                {filter.mode === "and"
                  ? `O item precisa bater com as ${ruleCount} regras marcadas abaixo.`
                  : `Basta o item bater com uma das ${ruleCount} regras marcadas abaixo.`}
              </p>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  active={filter.tagIds.includes(tag.id)}
                  onClick={() => state.toggleTag(tag.id)}
                />
              ))}
            </div>
          ) : null}

          {unified.length > 0 ? (
            <div className="space-y-4 border-t border-line pt-4">
              <p className="plaque">
                Campos {filter.categoryIds.length > 0 ? "das categorias marcadas" : "das categorias"}
              </p>

              {availableFields.length > 0 ? (
                <select
                  value=""
                  onChange={(event) => state.addActiveField(event.target.value)}
                  aria-label="Adicionar campo ao filtro"
                  className="h-9 w-full rounded-md border border-dashed border-line bg-bg-soft px-2 text-sm text-muted-foreground outline-none focus-visible:border-brand-dim"
                >
                  <option value="">+ Adicionar campo…</option>
                  {availableFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {activeFields.length === 0 ? (
                <p className="text-xs text-faint">
                  Escolha acima um campo das suas categorias para filtrar por ele.
                </p>
              ) : (
                activeFields.map((field) => (
                  <div key={field.key} className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <FieldControl
                        field={field}
                        value={filter.fields[field.key] ?? EMPTY_FIELD_FILTER}
                        onChange={(patch) => state.setField(field.key, patch)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => state.removeActiveField(field.key)}
                      title={`Tirar ${field.label} do filtro`}
                      aria-label={`Tirar ${field.label} do filtro`}
                      className="mt-5 shrink-0 rounded p-1 text-faint transition-colors hover:bg-surface-hi hover:text-danger"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: UnifiedField
  value: FieldFilter
  onChange: (patch: Partial<FieldFilter>) => void
}) {
  const where = field.categories.map((item) => item.categoryName).join(", ")

  return (
    <div className={cn("space-y-1.5", isFieldFilterActive(value) && "rounded-md")}>
      <Label className="block text-xs text-foreground">{field.label}</Label>
      <p className="text-[0.68rem] text-faint">em {where}</p>

      {isNumericField(field.tipo) ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={value.min}
            onChange={(event) => onChange({ min: event.target.value })}
            placeholder="mín"
            aria-label={`${field.label}: mínimo`}
            className="h-8"
          />
          <span className="text-faint">–</span>
          <Input
            type="number"
            value={value.max}
            onChange={(event) => onChange({ max: event.target.value })}
            placeholder="máx"
            aria-label={`${field.label}: máximo`}
            className="h-8"
          />
        </div>
      ) : field.tipo === "date" ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={value.min}
            onChange={(event) => onChange({ min: event.target.value })}
            aria-label={`${field.label}: de`}
            className="h-8"
          />
          <Input
            type="date"
            value={value.max}
            onChange={(event) => onChange({ max: event.target.value })}
            aria-label={`${field.label}: até`}
            className="h-8"
          />
        </div>
      ) : field.tipo === "select" ? (
        <select
          value={value.value}
          onChange={(event) => onChange({ value: event.target.value })}
          aria-label={field.label}
          className="h-8 w-full rounded-md border border-line bg-bg-soft px-2 text-sm outline-none focus-visible:border-brand-dim"
        >
          <option value="">qualquer</option>
          {field.opcoes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={value.value}
          onChange={(event) => onChange({ value: event.target.value })}
          placeholder="contém…"
          aria-label={field.label}
          className="h-8"
        />
      )}
    </div>
  )
}
