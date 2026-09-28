"use client"

import { useMemo } from "react"

import { useDemoData } from "@/components/demo/demo-provider"
import { TagsView } from "@/components/tag/tags-view"
import type { TagWithUsage } from "@/lib/queries/tags"

/** `/demo/tags` — as tags da demonstração (só desta visita, não as do grupo). */
export default function DemoTagsPage() {
  const { state } = useDemoData()

  const tags = useMemo((): TagWithUsage[] => {
    const usage = new Map<string, number>()
    for (const entry of state.entries) {
      for (const link of entry.entry_tags) {
        usage.set(link.tag_id, (usage.get(link.tag_id) ?? 0) + 1)
      }
    }
    return state.tags
      .map((tag) => ({ ...tag, usage: usage.get(tag.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [state])

  return <TagsView tags={tags} />
}
