import type { ReactNode } from "react"

import { Navbar } from "@/components/layout/navbar"
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
  return (
    <div className="min-h-dvh">
      <Navbar profile={profile} />
      <main className="shell pb-24">{children}</main>
    </div>
  )
}
