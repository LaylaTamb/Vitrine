"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { resetDemoDataAction } from "@/app/demo/actions"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

/**
 * Só aparece pra quem entrou pela conta demo (`/demo`). Fica sempre visível
 * — quem está testando precisa saber que é descartável, e o botão de
 * reiniciar precisa estar sempre à mão.
 */
export function DemoBanner() {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <div className="border-b border-brand-dim/40 bg-brand-wash px-4 py-2 text-center text-sm text-foreground">
        Modo demonstração — os dados são de teste e podem ser vistos e alterados por qualquer
        visitante.{" "}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-brand"
        >
          <RotateCcw className="size-3.5" /> Reiniciar dados de teste
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reiniciar dados de teste"
        description="Apaga tudo que foi criado ou alterado na demonstração até agora e volta pro acervo de exemplo original. Não afeta nenhuma conta de verdade."
        confirmLabel="Reiniciar"
        pendingLabel="Reiniciando…"
        onConfirm={async () => {
          const result = await resetDemoDataAction()
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Dados de teste reiniciados.")
          router.push("/")
          router.refresh()
        }}
      />
    </>
  )
}
