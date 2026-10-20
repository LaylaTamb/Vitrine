"use client"

import type { ReactNode } from "react"
import { toast } from "sonner"

/** Um link de rede sem página pública (o nome do Discord): o toque copia o nome. */
export function CopyHandleChip({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`“${value}” copiado. No Discord, adicione como amigo.`)
    } catch {
      toast.error("Não deu para copiar. Selecione o nome e copie à mão.")
    }
  }

  return (
    <button type="button" onClick={copy} title="Copiar o nome" className={className}>
      {children}
    </button>
  )
}
