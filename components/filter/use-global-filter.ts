"use client"

import { useMemo, useState } from "react"

import {
  EMPTY_FIELD_FILTER,
  EMPTY_GLOBAL_FILTER,
  applyGlobalFilter,
  categoriesInScope,
  globalSortOptions,
  isFieldFilterActive,
  isGlobalFilterActive,
  sortGlobalViews,
  unifyFields,
  type FieldFilter,
  type GlobalFilter,
  type MatchMode,
  type UnifiedField,
} from "@/lib/domain/filter"
import type { Category, EntryView } from "@/lib/domain/types"

/**
 * O estado do filtro geral — o mesmo no `/filtro` e no Mapa. Tudo em memória:
 * mexer no filtro não gera requisição nenhuma nem toca na URL.
 *
 * Campos de categorias diferentes viram o mesmo filtro quando nome e tipo
 * batem. Com categorias marcadas, só os campos delas aparecem. Tags marcadas
 * e campos ativos são "regras" combinadas pelo switch E/OU; nome, nota e
 * categoria valem sempre.
 */
export function useGlobalFilter(categories: Category[], views: EntryView[]) {
  const [filter, setFilter] = useState<GlobalFilter>(EMPTY_GLOBAL_FILTER)
  // Campos escolhidos manualmente para aparecer no filtro — todo campo de
  // toda categoria de uma vez sobrecarregava a barra lateral.
  const [activeFieldKeys, setActiveFieldKeys] = useState<string[]>([])

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
  const active = isGlobalFilterActive(filter)
  const ruleCount = filter.tagIds.length + activeFields.filter((field) =>
    isFieldFilterActive(filter.fields[field.key])
  ).length

  function setQuery(query: string) {
    setFilter((current) => ({ ...current, query }))
  }

  function setMinRating(minRating: string) {
    setFilter((current) => ({ ...current, minRating }))
  }

  function setMaxRating(maxRating: string) {
    setFilter((current) => ({ ...current, maxRating }))
  }

  function setMode(mode: MatchMode) {
    setFilter((current) => ({ ...current, mode }))
  }

  function toggleCategory(categoryId: string) {
    setFilter((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId],
    }))
  }

  function toggleTag(tagId: string) {
    setFilter((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }))
  }

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

  function toggleSortDir() {
    setFilter((current) => ({
      ...current,
      sortBy: sortOption.value,
      sortDir: sortDir === "asc" ? "desc" : "asc",
    }))
  }

  return {
    filter,
    unified,
    activeFields,
    availableFields,
    sortOptions,
    sortOption,
    sortDir,
    filtered,
    active,
    ruleCount,
    setQuery,
    setMinRating,
    setMaxRating,
    setMode,
    toggleCategory,
    toggleTag,
    setField,
    addActiveField,
    removeActiveField,
    clearAll,
    changeSort,
    toggleSortDir,
  }
}

export type GlobalFilterState = ReturnType<typeof useGlobalFilter>
