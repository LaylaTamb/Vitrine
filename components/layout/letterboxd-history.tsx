"use client"

import { useRouter } from "next/navigation"
import { History } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  letterboxdDetailsStepAction,
  letterboxdHistoryPagesAction,
} from "@/app/configuracoes/actions"
import { Button } from "@/components/ui/button"
import { letterboxdSummary } from "@/lib/domain/connected"

type Progress =
  | { phase: "idle" }
  | { phase: "pages"; page: number; lastPage: number }
  | { phase: "details"; done: number }

/**
 * "Trazer todos os filmes": o feed do @ só tem os ~50 mais recentes; isto lê
 * a lista inteira de filmes vistos do perfil, 4 páginas por chamada, e depois
 * pede os detalhes e os pôsteres ao TMDB em passos — até acabar. A tela fica
 * aberta enquanto isso (cada passo é curto, nenhum estoura o tempo).
 */
export function LetterboxdHistory({ tmdbReady }: { tmdbReady: boolean }) {
  const router = useRouter()
  const [progress, setProgress] = useState<Progress>({ phase: "idle" })
  const running = progress.phase !== "idle"

  async function run() {
    let page: number | null = 1
    let created = 0
    let updated = 0
    setProgress({ phase: "pages", page: 1, lastPage: 1 })
    while (page !== null) {
      const result = await letterboxdHistoryPagesAction({ page })
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Não deu para ler agora." : result.error)
        setProgress({ phase: "idle" })
        router.refresh()
        return
      }
      created += result.data.created
      updated += result.data.updated
      page = result.data.nextPage
      if (page !== null) setProgress({ phase: "pages", page, lastPage: result.data.lastPage })
    }

    if (tmdbReady) {
      let done = 0
      setProgress({ phase: "details", done })
      for (;;) {
        const step = await letterboxdDetailsStepAction()
        if (!step.ok || !step.data) break
        done += step.data.processed
        setProgress({ phase: "details", done })
        if (!step.data.more) break
      }
    }

    setProgress({ phase: "idle" })
    toast.success(`Histórico trazido. ${letterboxdSummary(created, updated)}`)
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Todos os seus filmes</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O @ traz só os ~50 mais recentes. Isto lê a lista inteira de filmes vistos do seu perfil
          no Letterboxd e junta na mesma categoria, sem repetir — com nome, ano e nota
          {tmdbReady ? "; o pôster e os detalhes vêm do TMDB em seguida" : ""}. Pode levar alguns
          minutos: deixe esta tela aberta.
        </p>
      </div>
      <Button variant="secondary" size="lg" onClick={run} disabled={running}>
        <History className="size-4" />
        {progress.phase === "pages"
          ? `Lendo a página ${progress.page} de ${progress.lastPage}…`
          : progress.phase === "details"
            ? `Buscando pôsteres e detalhes: ${progress.done} filmes…`
            : "Trazer todos os filmes"}
      </Button>
    </div>
  )
}
