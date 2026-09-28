"use client"

import { useMemo } from "react"

import { useDemoData } from "@/components/demo/demo-provider"
import { GlobalFilterView } from "@/components/filter/global-filter-view"
import { DEMO_BASE_PATH } from "@/lib/demo/config"
import type { EntryView, Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"

/** `/demo/filtro` — o filtro geral sobre o acervo em memória. */
export default function DemoFilterPage() {
  const { state } = useDemoData()

  const data = useMemo(() => {
    const categories = [...state.categories].sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")
    )
    const tagsById = new Map<string, Tag>(state.tags.map((tag) => [tag.id, tag]))
    const byId = new Map(categories.map((category) => [category.id, category]))
    const views: EntryView[] = []
    for (const entry of state.entries) {
      const category = byId.get(entry.category_id)
      if (!category) continue
      views.push(toView(entry, category.estrutura, tagsById, category.name, DEMO_BASE_PATH))
    }
    return {
      categories,
      views,
      tags: [...state.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }
  }, [state])

  return <GlobalFilterView categories={data.categories} views={data.views} tags={data.tags} />
}
