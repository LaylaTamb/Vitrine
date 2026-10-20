"use client"

import { Globe } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { dismissPublicNoticeAction } from "@/app/configuracoes/actions"
import { Button } from "@/components/ui/button"

/**
 * O aviso único de que "Pública" passou a querer dizer "na internet". Quem
 * decide se aparece é a página (`needsPublicNotice`); "Entendi" some na hora
 * e grava que a pessoa viu.
 */
export function PublicNotice() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function dismiss() {
    setDismissed(true)
    const result = await dismissPublicNoticeAction()
    if (!result.ok) {
      setDismissed(false)
      toast.error(result.error)
    }
  }

  return (
    <div
      role="status"
      className="mt-6 flex flex-col gap-3 rounded-lg border border-brand-dim bg-brand-wash px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-foreground">
            “Pública” agora quer dizer visível na internet, também para quem não tem conta.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Suas pastas e categorias públicas continuam públicas. Se alguma não deve aparecer
            para todo mundo, troque para Privada no topo dela.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={dismiss} className="self-end sm:self-auto">
        Entendi
      </Button>
    </div>
  )
}
