import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Estado vazio: ícone, título e uma frase. Nunca uma tela em branco. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-bg-soft px-6 py-16 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-wash text-brand">
        <Icon className="size-5" />
      </span>
      <h2 className="display text-xl">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
