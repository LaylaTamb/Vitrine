import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DemoBanner } from "@/components/demo/demo-banner"
import { DemoProvider } from "@/components/demo/demo-provider"
import { Navbar } from "@/components/layout/navbar"

export const metadata: Metadata = { title: "Demonstração · Vitrine" }

// As telas leem `?pasta=` e os filtros da URL já no primeiro HTML — sem isso
// o build tentaria pré-renderizar `/demo` estático, sem query string.
export const dynamic = "force-dynamic"

/**
 * `/demo` — a Vitrine inteira, sem login e sem banco.
 *
 * O acervo de exemplo vive no `DemoProvider` (memória do navegador). Como
 * este layout não desmonta ao navegar entre as páginas de `/demo`, o que o
 * visitante cria sobrevive à navegação — e some no F5.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <div className="min-h-dvh">
        <Navbar profile={null} isDemo />
        <DemoBanner />
        <main className="shell pb-24">{children}</main>
      </div>
    </DemoProvider>
  )
}
