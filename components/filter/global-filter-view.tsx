"use client"

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Filter, Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { EntryCard } from "@/components/entry/entry-card"
import { MatchModeToggle } from "@/components/filter/match-mode-toggle"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isNumericField } from "@/lib/domain/fields"
import {
  EMPTY_FIELD_FILTER,
  EMPTY_GLOBAL_FILTER,
  applyGlobalFilter,
  categoriesInScope,
  globalSortOptions,
  groupByCategory,
  isFieldFilterActive,
  isGlobalFilterActive,
  sortDirLabel,
  sortGlobalViews,
  unifyFields,
  type FieldFilter,
  type GlobalFilter,
  type UnifiedField,
} from "@/lib/domain/filter"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, EntryView, Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

const GROUP_STORAGE_KEY = "vitrine:filtro:agrupar"

/**
 * `/filtro` — cruza todas as categorias de uma vez.
 *
 * Campos de categorias diferentes viram o mesmo filtro quando nome e tipo
 * batem. Com categorias marcadas, só os campos delas aparecem. Tags marcadas
 * e campos ativos são "regras" combinadas pelo switch E/OU; nome, nota e
 * categoria valem sempre.
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
  const [filter, setFilter] = useState<GlobalFilter>(EMPTY_GLOBAL_FILTER)
  // Campos escolhidos manualmente para aparecer no filtro — todo campo de
  // toda categoria de uma vez sobrecarregava a barra lateral.
  const [activeFieldKeys, setActiveFieldKeys] = useState<string[]>([])
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

  // Só as categorias marcadas (ou todas) fornecem campos. Um campo de uma
  // categoria desmarcada some da barra e deixa de filtrar; volta com o valor
  // de antes se a categoria for marcada de novo.
  const scope = useMemo(
    () => categoriesInScope(categories, filter.categoryIds),
    [categories, filter.categoryIds]
  )
  const unified = useMemo(() => unifyFields(scope), [scope])
  const activeFields = useMemo(
    () =>
      activeFieldKeys
        .map((key) => unified.find((field) => field.key === key))
        .filter((field): field is UnifiedField => Boolean(field)),
    [activeFieldKeys, unified]
  )
  const availableFields = useMemo(
    () => unified.filter((field) => !activeFieldKeys.includes(field.key)),
    [unified, activeFieldKeys]
  )

  const sortOptions = useMemo(() => globalSortOptions(unified), [unified])
  // Ordenar por um campo que saiu do escopo cai de volta em "Data de adição".
  const sortOption =
    sortOptions.find((option) => option.value === filter.sortBy) ?? sortOptions[0]
  const sortDir = sortOption.value === filter.sortBy ? filter.sortDir : sortOption.defaultDir

  const filtered = useMemo(
    () =>
      sortGlobalViews(applyGlobalFilter(views, filter, unified), sortOption.value, sortDir, unified),
    [views, filter, unified, sortOption.value, sortDir]
  )
  const groups = useMemo(() => groupByCategory(filtered, categories), [filtered, categories])
  const active = isGlobalFilterActive(filter)
  const ruleCount = filter.tagIds.length + activeFields.filter((field) =>
    isFieldFilterActive(filter.fields[field.key])
  ).length

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  function setField(key: string, patch: Partial<FieldFilter>) {
    setFilter((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [key]: { ...EMPTY_FIELD_FILTER, ...current.fields[key], ...patch },
      },
    }))
  }

  function addActiveField(key: string) {
    if (!key || activeFieldKeys.includes(key)) return
    setActiveFieldKeys((current) => [...current, key])
  }

  function removeActiveField(key: string) {
    setActiveFieldKeys((current) => current.filter((item) => item !== key))
    setFilter((current) => {
      const fields = { ...current.fields }
      delete fields[key]
      return { ...current, fields }
    })
  }

  /** Limpa o recorte; ordenação e modo E/OU ficam como estão. */
  function clearAll() {
    setFilter((current) => ({
      ...EMPTY_GLOBAL_FILTER,
      mode: current.mode,
      sortBy: current.sortBy,
      sortDir: current.sortDir,
    }))
    setActiveFieldKeys([])
  }

  function changeSort(value: string) {
    const option = sortOptions.find((item) => item.value === value)
    if (!option) return
    setFilter((current) => ({ ...current, sortBy: option.value, sortDir: option.defaultDir }))
  }

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
          <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <p className="plaque">Sempre valem</p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input
                value={filter.query}
                onChange={(event) =>
                  setFilter((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Nome do item"
                aria-label="Nome do item"
                className="pl-8"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="plaque shrink-0">Nota</span>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={filter.minRating}
                onChange={(event) =>
                  setFilter((current) => ({ ...current, minRating: event.target.value }))
                }
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
                onChange={(event) =>
                  setFilter((current) => ({ ...current, maxRating: event.target.value }))
                }
                placeholder="máx"
                aria-label="Nota máxima"
              />
            </div>

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
                        onCheckedChange={() =>
                          setFilter((current) => ({
                            ...current,
                            categoryIds: current.categoryIds.includes(category.id)
                              ? current.categoryIds.filter((id) => id !== category.id)
                              : [...current.categoryIds, category.id],
                          }))
                        }
                      />
                      {category.icon ? <span aria-hidden>{category.icon}</span> : null}
                      <span className="truncate">{category.name}</span>
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
                <MatchModeToggle
                  value={filter.mode}
                  onChange={(mode) => setFilter((current) => ({ ...current, mode }))}
                />
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
                      onClick={() =>
                        setFilter((current) => ({
                          ...current,
                          tagIds: current.tagIds.includes(tag.id)
                            ? current.tagIds.filter((id) => id !== tag.id)
                            : [...current.tagIds, tag.id],
                        }))
                      }
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
                      onChange={(event) => addActiveField(event.target.value)}
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
                            onChange={(patch) => setField(field.key, patch)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeActiveField(field.key)}
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
                  onChange={(event) => changeSort(event.target.value)}
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
                  onClick={() =>
                    setFilter((current) => ({
                      ...current,
                      sortBy: sortOption.value,
                      sortDir: sortDir === "asc" ? "desc" : "asc",
                    }))
                  }
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
