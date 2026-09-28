"use client"

import Link from "next/link"
import { SearchX } from "lucide-react"

import { EmptyState } from "@/components/layout/empty-state"
import { Button } from "@/components/ui/button"
import { DEMO_BASE_PATH } from "@/lib/demo/config"

/**
 * Link de algo criado antes de um F5: a demonstração recomeça do zero a cada
 * carregamento, então isso não existe mais.
 */
export function DemoNotFound({ title }: { title: string }) {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title={title}
        description="A demonstração recomeça do zero a cada recarregamento — o que foi criado antes do F5 não existe mais."
        action={
          <Button asChild variant="outline">
            <Link href={DEMO_BASE_PATH}>Voltar às Coleções</Link>
          </Button>
        }
      />
    </div>
  )
}
