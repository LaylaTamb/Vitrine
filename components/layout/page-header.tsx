import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * O cabeçalho de plaqueta: rótulo em caixa alta, título em Fraunces itálico,
 * subtítulo discreto e, à direita, as ações da página.
 */
export function PageHeader({
  label,
  title,
  subtitle,
  actions,
  className,
}: {
  label?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {label ? <p className="plaque">{label}</p> : null}
        <h1 className="display text-3xl leading-tight break-words sm:text-4xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
