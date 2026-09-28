"use client"

import { useMemo } from "react"

import { CollectionsView } from "@/components/collection/collections-view"
import { useDemoData } from "@/components/demo/demo-provider"
import { DEMO_PROFILE, demoCounts } from "@/lib/demo/state"
import { itemCount, plural } from "@/lib/domain/format"

/** `/demo` — as Coleções do acervo de exemplo. */
export default function DemoCollectionsPage() {
  const { state } = useDemoData()
  const counts = useMemo(() => demoCounts(state), [state])

  return (
    <CollectionsView
      folders={state.folders}
      categories={state.categories}
      counts={counts}
      canEdit
      headerLabel="Demonstração"
      headerTitle={DEMO_PROFILE.display_name ?? DEMO_PROFILE.username}
      headerSubtitle={
        state.categories.length === 0
          ? "Suas coleções"
          : `${plural(state.categories.length, "categoria", "categorias")} · ${itemCount(state.entries.length)}`
      }
    />
  )
}
