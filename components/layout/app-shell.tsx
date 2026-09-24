import type { ReactNode } from "react"

import { DemoBanner } from "@/components/layout/demo-banner"
import { Navbar } from "@/components/layout/navbar"
import { DEMO_USERNAME } from "@/lib/demo/config"
import type { Profile } from "@/lib/domain/types"

/**
 * O esqueleto de toda página autenticada.
 *
 * Recebe o perfil pronto por prop de propósito: quem busca é o Server
 * Component da página, junto das outras consultas, em paralelo. Se o shell
 * fosse buscar sozinho, viraria mais um `await` em série.
 */
export function AppShell({
  profile,
  children,
}: {
  profile: Profile | null
  children: ReactNode
}) {
  const isDemo = profile?.username === DEMO_USERNAME

  return (
    <div className="min-h-dvh">
      <Navbar profile={profile} isDemo={isDemo} />
      {isDemo ? <DemoBanner /> : null}
      <main className="shell pb-24">{children}</main>
    </div>
  )
}
