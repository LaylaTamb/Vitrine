"use client"

import { Star } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A estrela de uma categoria (migração 20): marca as favoritas, que a estrela
 * do canto das Coleções junta numa tela só. A categoria não sai da pasta dela.
 * Só o dono vê.
 */

/** O texto do botão — leitor de tela e dica. */
function favoriteLabel(active: boolean, name: string): string {
  return active ? `Tirar “${name}” dos favoritos` : `Favoritar “${name}”`
}

/**
 * O botão da estrela nos cards — sempre à vista (vazada nas outras, cheia na
 * favorita), para ninguém precisar procurar onde marcar.
 */
export function FavoriteToggle({
  active,
  name,
  onToggle,
  className,
}: {
  active: boolean
  name: string
  onToggle: () => void
  className?: string
}) {
  const label = favoriteLabel(active, name)
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
      className={cn(
        "rounded-lg border border-line bg-bg/85 p-1.5 backdrop-blur-sm transition-colors hover:text-brand",
        active ? "text-brand" : "text-muted-foreground",
        className
      )}
    >
      <Star className={cn("size-3.5", active && "fill-current")} />
    </button>
  )
}

/** A estrela do topo da categoria, colada no nome. */
export function CategoryFavoriteButton({
  categoryId,
  categoryName,
  isFavorite,
}: {
  categoryId: string
  categoryName: string
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
    const result = await actions.setCategoryFavorite({ categoryId, favorite: next })
    setPending(false)
    if (!result.ok) {
      setOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(
      next ? `“${categoryName}” está nos favoritos.` : `“${categoryName}” saiu dos favoritos.`
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={toggle}
      disabled={pending}
      aria-pressed={active}
      aria-label={favoriteLabel(active, categoryName)}
      title={favoriteLabel(active, categoryName)}
      className={cn("shrink-0", active ? "text-brand" : "text-muted-foreground")}
    >
      <Star className={cn("size-5", active && "fill-current")} />
    </Button>
  )
}
