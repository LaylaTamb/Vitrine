"use client"

import { Star } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import { cn } from "@/lib/utils"

/**
 * O favorito da categoria (migração 20): um por categoria, só o dono vê.
 * Tocar marca; marcar outro troca; tocar de novo desmarca.
 */

/** O botão da estrela, para o grupo de ações do card e da linha. */
export function FavoriteToggle({
  active,
  name,
  onToggle,
}: {
  active: boolean
  name: string
  onToggle: () => void
}) {
  const label = active
    ? `Tirar “${name}” de favorito da categoria`
    : `Marcar “${name}” como favorito da categoria`
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-brand"
    >
      <Star className={cn("size-3.5", active && "fill-current text-brand")} />
    </button>
  )
}

/** A marca discreta ao lado do nome, sempre à vista no favorito. */
export function FavoriteMark() {
  return (
    <Star
      role="img"
      aria-label="Favorito da categoria"
      className="size-3.5 shrink-0 fill-current text-brand"
    >
      <title>Favorito da categoria</title>
    </Star>
  )
}

/** A estrela da página do item: o botão com o estado escrito. */
export function FavoriteDetailToggle({
  categoryId,
  categoryName,
  entryId,
  entryName,
  isFavorite,
}: {
  categoryId: string
  categoryName: string
  entryId: string
  entryName: string
  isFavorite: boolean
}) {
  const { actions } = useVitrine()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const active = optimistic ?? isFavorite

  // O dado do servidor chegou: ele manda de novo.
  useEffect(() => {
    setOptimistic(null)
  }, [isFavorite])

  async function toggle() {
    const next = !active
    setOptimistic(next)
    setPending(true)
    const result = await actions.setFavoriteEntry({ categoryId, entryId: next ? entryId : null })
    setPending(false)
    if (!result.ok) {
      setOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(
      next ? `“${entryName}” é o favorito de “${categoryName}”.` : "Favorito desmarcado."
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors disabled:cursor-wait",
        active
          ? "border-brand-dim bg-brand-wash text-foreground"
          : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
      )}
    >
      <Star aria-hidden className={cn("size-3.5", active && "fill-current text-brand")} />
      {active ? `Favorito de “${categoryName}”` : "Marcar como favorito"}
    </button>
  )
}
