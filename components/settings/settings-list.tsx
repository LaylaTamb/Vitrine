import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Um grupo das Configurações: o título em plaqueta (se houver) e as linhas num cartão. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      {title ? <h2 className="plaque px-1">{title}</h2> : null}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {children}
      </ul>
    </section>
  )
}

/**
 * Uma linha: ícone, nome, o valor atual (quando há) e a seta. Sem `href`, é
 * só informação (o e-mail).
 */
export function SettingsRow({
  icon: Icon,
  label,
  value,
  href,
  danger = false,
}: {
  icon: LucideIcon
  label: string
  value?: string | null
  href?: string
  danger?: boolean
}) {
  const body = (
    <>
      <Icon
        aria-hidden
        className={cn("size-5 shrink-0", danger ? "text-danger" : "text-muted-foreground")}
      />
      <span className={cn("min-w-0 flex-1 text-sm", danger && "text-danger")}>{label}</span>
      {value ? (
        <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span>
      ) : null}
      {href ? <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" /> : null}
    </>
  )
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hi"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
      )}
    </li>
  )
}
