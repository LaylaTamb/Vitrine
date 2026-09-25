"use client"

import { Filter, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { EntryCard } from "@/components/entry/entry-card"
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
  groupByCategory,
  isFieldFilterActive,
  isGlobalFilterActive,
  unifyFields,
  type FieldFilter,
  type GlobalFilter,
  type UnifiedField,
} from "@/lib/domain/filter"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, EntryView, Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * `/filtro` — cruza todas as categorias de uma vez.
 *
 * Campos de categorias diferentes viram o mesmo filtro quando nome e tipo
 * batem. Com um campo ativo, item que não tem esse campo (ou está com ele
 * vazio) fica de fora — e os filtros ativos são combinados com AND.
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

  const unified = useMemo(() => unifyFields(categories), [categories])
  const activeFields = useMemo(
    () => activeFieldKeys.map((key) => unified.find((field) => field.key === key)).filter(
      (field): field is UnifiedField => Boolean(field)
    ),
    [activeFieldKeys, unified]
  )
  const availableFields = useMemo(
    () => unified.filter((field) => !activeFieldKeys.includes(field.key)),
    [unified, activeFieldKeys]
  )
  const filtered = useMemo(
    () => applyGlobalFilter(views, filter, unified),
    [views, filter, unified]
  )
  const groups = useMemo(() => groupByCategory(filtered, categories), [filtered, categories])
  const active = isGlobalFilterActive(filter)

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

  function clearAll() {
    setFilter(EMPTY_GLOBAL_FILTER)
    setActiveFieldKeys([])
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

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
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
          </div>

          {unified.length > 0 ? (
            <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
              <p className="plaque">Campos das categorias</p>

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
        </aside>

        <section className="min-w-0 space-y-6">
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
              description="Nenhum item do seu acervo passa por esse recorte."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Limpar tudo
                </Button>
              }
            />
          ) : (
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
