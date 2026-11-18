"use client"

import type { LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Um aviso discreto, numa linha com ícone, no topo de uma tela. O detalhe
 * (se houver) abre no "Mais", para os avisos não se empilharem em caixas.
 */
export function Notice({
  icon: Icon,
  children,
  details,
  action,
  tone = "muted",
  role,
}: {
  icon: LucideIcon
  children: ReactNode
  /** A explicação longa: só aparece ao tocar em "Mais". */
  details?: ReactNode
  /** Um botão à direita (ex.: Desligar). */
  action?: ReactNode
  /** "brand": o ícone na cor do app, para o que é da pessoa (ligação, caixa de entrada). */
  tone?: "muted" | "brand"
  role?: "status"
}) {
  const [open, setOpen] = useState(false)

  return (
    <div role={role} className="text-xs leading-relaxed text-muted-foreground">
      <div className="flex items-start gap-2">
        <Icon
          aria-hidden
          className={cn("mt-0.5 size-3.5 shrink-0", tone === "brand" ? "text-brand" : "text-faint")}
        />
        <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {children}
          {details ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                className="text-brand underline-offset-2 hover:underline"
              >
                {open ? "Menos" : "Mais"}
              </button>
            </>
          ) : null}
        </p>
        {action}
      </div>
      {details && open ? <div className="mt-1 pl-5.5">{details}</div> : null}
    </div>
  )
}
