"use client"

import { useMemo } from "react"

import { useDemoData } from "@/components/demo/demo-provider"
import { FavoritesView } from "@/components/favorites/favorites-view"

/** `/demo/favoritos` — a mesma aba Favoritos, lendo do acervo em memória. */
export default function DemoFavoritesPage() {
  const { state } = useDemoData()

  const data = useMemo(() => {
    const favoriteIds = new Set(state.favorites.map((row) => row.entry_id).filter(Boolean))
    return {
      categories: [...state.categories].sort(
        (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")
      ),
      entries: state.entries.filter((entry) => favoriteIds.has(entry.id)),
      tags: [...state.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }
  }, [state])

  return (
    <FavoritesView
      ready
      rows={state.favorites}
      categories={data.categories}
      entries={data.entries}
      tags={data.tags}
    />
  )
}
