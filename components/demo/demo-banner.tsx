"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { useDemoData } from "@/components/demo/demo-provider"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DEMO_BASE_PATH } from "@/lib/demo/config"

/**
 * Sempre visível na demonstração: quem está testando precisa saber que nada
 * é salvo — e o botão de recomeçar precisa estar à mão.
 */
export function DemoBanner() {
  const router = useRouter()
  const { reset } = useDemoData()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <div className="border-b border-brand-dim/40 bg-brand-wash px-4 py-2 text-center text-sm text-foreground">
        Modo demonstração — mexa à vontade: nada é salvo, e recarregar a página (F5) volta tudo ao
        exemplo.{" "}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-brand"
        >
          <RotateCcw className="size-3.5" /> Recomeçar agora
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Recomeçar a demonstração"
        description="Desfaz tudo o que você criou ou alterou nesta visita e volta ao acervo de exemplo."
        confirmLabel="Recomeçar"
        pendingLabel="Recomeçando…"
        onConfirm={() => {
          reset()
          toast.success("Demonstração reiniciada.")
          router.push(DEMO_BASE_PATH)
        }}
      />
    </>
  )
}
