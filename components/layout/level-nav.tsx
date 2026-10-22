"use client"

import { useDroppable } from "@dnd-kit/core"
import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import { levelTargetId } from "@/lib/domain/drag"
import { cn } from "@/lib/utils"

/**
 * Um degrau da trilha. Com `href` vira link (troca de página); com `onClick`,
 * botão (troca de nível na mesma página, sem ida ao servidor).
 */
export interface Crumb {
  key: string
  label: ReactNode
  href?: string
  onClick?: () => void
  /**
   * Soltar um card arrastado aqui leva para este nível (`null` = a raiz).
   * Ausente = não é alvo. Só vale dentro de um `DndContext`.
   */
  dropLevel?: string | null
}

/**
 * "← Voltar" + a trilha inteira da organização:
 * `Coleções › Bebidas › 🧃 Suco › Marca 1`.
 *
 * O Voltar sobe UM nível (o degrau anterior ao atual) — até chegar nas
 * Coleções, onde some. O último degrau é onde você está: não é clicável.
 * Degraus com `dropLevel` (e o Voltar deles) também recebem um card
 * arrastado: soltar ali sobe o card para aquele nível.
 */
export function LevelNav({ trail }: { trail: Crumb[] }) {
  const parent = trail.length > 1 ? trail[trail.length - 2] : null

  return (
    <nav aria-label="Onde você está" className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-5 text-sm">
      {parent ? (
        <CrumbTarget
          crumb={parent}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
          ariaLabel="Voltar um nível"
          back
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </CrumbTarget>
      ) : null}

      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1
          return (
            <li key={crumb.key} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-faint" /> : null}
              {last ? (
                <span aria-current="location" className="rounded px-1.5 py-0.5 text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <CrumbTarget
                  crumb={crumb}
                  className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </CrumbTarget>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function CrumbTarget({
  crumb,
  className,
  ariaLabel,
  back = false,
  children,
}: {
  crumb: Crumb
  className: string
  ariaLabel?: string
  /** É o "← Voltar" (outro alvo, para o mesmo nível). */
  back?: boolean
  children: ReactNode
}) {
  const droppable = crumb.dropLevel !== undefined
  // Quem não é alvo ganha um id só dele: dois ids iguais (mesmo desligados) se
  // atropelariam no registro do dnd-kit.
  const { setNodeRef, isOver } = useDroppable({
    id: droppable
      ? levelTargetId(crumb.dropLevel ?? null, back)
      : `degrau:${crumb.key}${back ? ":voltar" : ""}`,
    disabled: !droppable,
  })
  const classes = cn(
    className,
    isOver && "bg-brand-wash text-foreground ring-1 ring-brand-dim"
  )

  if (crumb.href) {
    return (
      <Link ref={setNodeRef} href={crumb.href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={crumb.onClick}
      className={classes}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}
