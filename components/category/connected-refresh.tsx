"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { refreshConnectedCategoryAction } from "@/app/categoria/[categoryId]/actions"
import { PROVIDER_LABELS, type ConnectedProvider } from "@/lib/domain/connected"

/** "na Steam", "no Letterboxd". */
const WHERE: Record<ConnectedProvider, string> = {
  steam: "na Steam",
  letterboxd: "no Letterboxd",
}

/**
 * A categoria da Steam ou do Letterboxd, aberta depois de 1 hora: busca as
 * novidades sem segurar a página (que já pintou com o que tinha) e, se algo
 * mudou, recarrega a lista. Falha não vira aviso aqui: fica registrada e
 * aparece no Editar cartão.
 */
export function ConnectedRefresh({
  categoryId,
  provider,
}: {
  categoryId: string
  provider: ConnectedProvider
}) {
  const router = useRouter()
  const [running, setRunning] = useState(true)
  // Em desenvolvimento o efeito roda duas vezes: a busca, uma só.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const result = await refreshConnectedCategoryAction({ id: categoryId })
      setRunning(false)
      if (result.ok && result.data?.changed) {
        toast.success(`${PROVIDER_LABELS[provider]}: ${result.data.summary ?? "atualizado."}`)
        router.refresh()
      }
    })()
  }, [categoryId, provider, router])

  if (!running) return null
  return (
    <p role="status" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw aria-hidden className="size-3.5 animate-spin" />
      Buscando novidades {WHERE[provider]}…
    </p>
  )
}
