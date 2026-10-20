import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * O cabeçalho de plaqueta: rótulo em caixa alta, título em Fraunces itálico,
 * subtítulo discreto e, à direita, as ações da página. Quando o título e as
 * ações não cabem lado a lado (tablet, título longo), as ações descem para a
 * linha de baixo em vez de passar por cima do título.
 */
export function PageHeader({
  label,
  title,
  subtitle,
  actions,
  className,
  as: Heading = "h1",
}: {
  label?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
  /** `h2` quando outro bloco da página já tem o `h1` (o cartão do perfil). */
  as?: "h1" | "h2"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 py-7 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {label ? <p className="plaque">{label}</p> : null}
        <Heading className="display text-3xl leading-tight break-words sm:text-4xl">{title}</Heading>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
