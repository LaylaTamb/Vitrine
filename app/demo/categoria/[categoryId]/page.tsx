"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { CategoryView } from "@/components/category/category-view"
import { useDemoData } from "@/components/demo/demo-provider"
import { DemoNotFound } from "@/components/demo/demo-not-found"
import { DEMO_BASE_PATH } from "@/lib/demo/config"
import { categoryFilterFromParams } from "@/lib/domain/filter"
import type { Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"

/** `/demo/categoria/[id]` — a mesma tela de categoria, lendo do acervo em memória. */
export default function DemoCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const searchParams = useSearchParams()
  const { state } = useDemoData()

  // A URL só vale na entrada, como no app (o filtro depois vive no cliente).
  const [initialFilter] = useState(() =>
    categoryFilterFromParams({
      q: searchParams.get("q"),
      min: searchParams.get("min"),
      max: searchParams.get("max"),
      tags: searchParams.get("tags"),
      modo: searchParams.get("modo"),
      ordem: searchParams.get("ordem"),
    })
  )
  const [initialTab] = useState<"itens" | "numeros">(() =>
    searchParams.get("aba") === "numeros" ? "numeros" : "itens"
  )

  const category = state.categories.find((item) => item.id === categoryId) ?? null

  const data = useMemo(() => {
    if (!category) return null
    const tagsById = new Map<string, Tag>(state.tags.map((tag) => [tag.id, tag]))
    return {
      views: state.entries
        .filter((entry) => entry.category_id === category.id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
        .map((entry) => toView(entry, category.estrutura, tagsById, category.name, DEMO_BASE_PATH)),
      siblings: [...state.categories].sort(
        (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")
      ),
      entryFolders: state.entryFolders.filter((folder) => folder.category_id === category.id),
      tags: [...state.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }
  }, [state, category])

  if (!category || !data) return <DemoNotFound title="Categoria não encontrada" />

  return (
    <CategoryView
      key={category.id}
      category={category}
      owner={null}
      siblings={data.siblings}
      views={data.views}
      tags={data.tags}
      entryFolders={data.entryFolders}
      collectionFolders={state.folders}
      collectionsHref={DEMO_BASE_PATH}
      canEdit
      initialFilter={initialFilter}
      initialTab={initialTab}
    />
  )
}
