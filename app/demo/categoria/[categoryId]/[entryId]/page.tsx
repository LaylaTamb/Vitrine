"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"

import { useDemoData } from "@/components/demo/demo-provider"
import { DemoNotFound } from "@/components/demo/demo-not-found"
import { EntryDetail } from "@/components/entry/entry-detail"
import { DEMO_BASE_PATH } from "@/lib/demo/config"
import type { Tag } from "@/lib/domain/types"
import { toView } from "@/lib/domain/view"

/** `/demo/categoria/[id]/[entryId]` — a plaqueta do item, do acervo em memória. */
export default function DemoEntryPage() {
  const { entryId } = useParams<{ categoryId: string; entryId: string }>()
  const { state } = useDemoData()

  const entry = state.entries.find((item) => item.id === entryId) ?? null
  const category = entry
    ? (state.categories.find((item) => item.id === entry.category_id) ?? null)
    : null

  const view = useMemo(() => {
    if (!entry || !category) return null
    const tagsById = new Map<string, Tag>(state.tags.map((tag) => [tag.id, tag]))
    return toView(entry, category.estrutura, tagsById, category.name, DEMO_BASE_PATH)
  }, [entry, category, state.tags])

  if (!entry || !category || !view) return <DemoNotFound title="Item não encontrado" />

  return (
    <EntryDetail
      view={view}
      category={category}
      owner={null}
      tags={[...state.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))}
      entryFolders={state.entryFolders.filter((folder) => folder.category_id === category.id)}
      canEdit
      basePath={DEMO_BASE_PATH}
    />
  )
}
