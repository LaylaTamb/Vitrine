"use client"

import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { EmptyState } from "@/components/layout/empty-state"
import { Wordmark } from "@/components/layout/wordmark"
import { Button } from "@/components/ui/button"

/**
 * Rede de segurança de toda página autenticada: sem isso, um erro não tratado
 * cai na tela genérica do Next em produção. `reset()` tenta renderizar nesta
 * mesma posição de novo, sem recarregar a página inteira.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Wordmark size="lg" />
        </div>

        <EmptyState
          icon={AlertTriangle}
          title="Algo quebrou"
          description="Não era pra acontecer. Tenta de novo — se continuar, volta pro início."
          action={
            <div className="flex items-center gap-2">
              <Button onClick={() => reset()}>Tentar de novo</Button>
              <Button variant="ghost" asChild>
                <Link href="/">Voltar para o início</Link>
              </Button>
            </div>
          }
        />
      </div>
    </main>
  )
}
