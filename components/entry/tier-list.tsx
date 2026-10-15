"use client"

import Link from "next/link"
import { Rows3 } from "lucide-react"

import { EntryImage } from "@/components/entry/entry-image"
import { EmptyState } from "@/components/layout/empty-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { plural } from "@/lib/domain/format"
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
 * a E, como no Tier Maker. Somente leitura — sem arrastar, sem seleção, sem
 * editar: mudar um item de fileira mudaria a nota dele.
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

  if (unrated === views.length) {
    return (
      <EmptyState
        icon={Rows3}
        title="Nenhum item com nota neste nível ainda."
        description="Dê estrelas aos itens para eles entrarem nas fileiras."
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1.5">
        {rows.map(({ tier, views: tierViews }) => (
          <section
            key={tier.id}
            aria-label={`Fileira ${tier.id}: nota ${tier.notes}`}
            className="flex overflow-hidden rounded-lg border border-line"
          >
            <div
              className="flex w-14 shrink-0 items-center justify-center sm:w-20"
              style={{ background: tier.color, color: TIER_INK }}
            >
              <span aria-hidden className="display text-3xl leading-none sm:text-4xl">
                {tier.id}
              </span>
            </div>

            <ul
              className={cn(
                "flex min-w-0 flex-1 flex-wrap content-start gap-2 bg-surface p-2",
                ROW_MIN_HEIGHT[gridSize]
              )}
            >
              {tierViews.map((view) => (
                <li key={view.id} className={cn("shrink-0", TIER_THUMB_CLASSES[gridSize])}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={view.href}
                        aria-label={`${view.name} — nota ${view.ratingLabel}`}
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
                          <span className="display absolute right-1 top-1 z-10 rounded border border-line bg-bg/85 px-1 text-[0.7rem] leading-4 text-foreground backdrop-blur-sm">
                            {view.ratingLabel}
                          </span>
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
        ))}

        {unrated > 0 ? (
          <p className="pt-1 text-xs text-faint">
            {plural(unrated, "item sem nota não aparece", "itens sem nota não aparecem")} aqui.
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
