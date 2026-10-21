"use client"

import Link from "next/link"
import { Rows3 } from "lucide-react"
import type { ReactNode } from "react"

import { EntryImage } from "@/components/entry/entry-image"
import { EmptyState } from "@/components/layout/empty-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TIER_THUMB_CLASSES, type GridSize } from "@/lib/domain/grid-size"
import { TIER_INK, groupByTier } from "@/lib/domain/tiers"
import type { EntryView } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * Altura mínima da fileira, mesmo vazia: a miniatura + o nome embaixo + o
 * respiro — assim a fileira vazia tem a altura de uma com uma linha de itens.
 */
const ROW_MIN_HEIGHT: Record<GridSize, string> = {
  small: "min-h-24",
  medium: "min-h-30",
  large: "min-h-38",
}

/** Tamanho da inicial quando o item não tem imagem. */
const INITIAL_SIZE: Record<GridSize, string> = {
  small: "1.5rem",
  medium: "2rem",
  large: "2.75rem",
}

/**
 * O tier list de um nível da categoria: uma fileira por faixa de nota, de S
 * a E, como no Tier Maker, e a faixa "Sem nota" no fim (só quando há item
 * sem nota). Somente leitura — sem arrastar, sem seleção, sem editar: mudar
 * um item de fileira mudaria a nota dele.
 *
 * Recebe os itens já filtrados e ordenados; dentro de cada fileira a ordem
 * é a mesma.
 */
export function TierList({
  views,
  gridSize,
  categoryColor,
}: {
  views: EntryView[]
  gridSize: GridSize
  categoryColor?: string | null
}) {
  const { rows, unrated } = groupByTier(views)

  if (views.length === 0) {
    return (
      <EmptyState
        icon={Rows3}
        title="Nenhum item neste nível ainda."
        description="Dê estrelas aos itens para eles entrarem nas fileiras."
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1.5">
        {rows.map(({ tier, views: tierViews }) => (
          <TierRowView
            key={tier.id}
            label={`Fileira ${tier.id}: nota ${tier.notes}`}
            views={tierViews}
            gridSize={gridSize}
            categoryColor={categoryColor}
            badge={
              <div
                className="flex w-14 shrink-0 items-center justify-center sm:w-20"
                style={{ background: tier.color, color: TIER_INK }}
              >
                <span aria-hidden className="display text-3xl leading-none sm:text-4xl">
                  {tier.id}
                </span>
              </div>
            }
          />
        ))}

        {unrated.length > 0 ? (
          <TierRowView
            label="Sem nota"
            views={unrated}
            gridSize={gridSize}
            categoryColor={categoryColor}
            badge={
              <div className="flex w-14 shrink-0 items-center justify-center bg-surface-hi px-1 text-center sm:w-20">
                <span aria-hidden className="text-[0.7rem] leading-tight text-muted-foreground">
                  Sem nota
                </span>
              </div>
            }
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}

/** Uma fileira: a caixa da esquerda (a letra, ou "Sem nota") e as miniaturas. */
function TierRowView({
  label,
  badge,
  views,
  gridSize,
  categoryColor,
}: {
  label: string
  badge: ReactNode
  views: EntryView[]
  gridSize: GridSize
  categoryColor?: string | null
}) {
  return (
    <section aria-label={label} className="flex overflow-hidden rounded-lg border border-line">
      {badge}

      <ul
        className={cn(
          "flex min-w-0 flex-1 flex-wrap content-start gap-2 bg-surface p-2",
          ROW_MIN_HEIGHT[gridSize]
        )}
      >
        {views.map((view) => (
          <li key={view.id} className={cn("shrink-0", TIER_THUMB_CLASSES[gridSize])}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={view.href}
                  aria-label={
                    view.hasRating ? `${view.name} — nota ${view.ratingLabel}` : `${view.name} — sem nota`
                  }
                  className="group/tier block rounded-md outline-none transition-transform hover:-translate-y-0.5"
                >
                  <span className="relative block">
                    <EntryImage
                      imageUrl={view.imageUrl}
                      imageTransform={view.imageTransform}
                      initial={view.initial}
                      initialSize={INITIAL_SIZE[gridSize]}
                      ratio="1 / 1"
                      tint={categoryColor}
                    />
                    {view.hasRating ? (
                      <span className="display absolute right-1 top-1 z-10 rounded border border-line bg-bg/85 px-1 text-[0.7rem] leading-4 text-foreground backdrop-blur-sm">
                        {view.ratingLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground group-hover/tier:text-foreground">
                    {view.name}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{view.name}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  )
}
