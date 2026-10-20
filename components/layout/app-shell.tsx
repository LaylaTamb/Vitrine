import Link from "next/link"
import type { ReactNode } from "react"

import { Navbar } from "@/components/layout/navbar"
import { InstallBanner } from "@/components/pwa/install"
import type { Profile } from "@/lib/domain/types"

/** Quem abre uma página pública sem conta: para onde voltar depois de entrar. */
export interface VisitorInfo {
  next: string
}

/**
 * O esqueleto de toda página do app.
 *
 * Recebe o perfil pronto por prop de propósito: quem busca é o Server
 * Component da página, junto das outras consultas, em paralelo. Se o shell
 * fosse buscar sozinho, viraria mais um `await` em série.
 *
 * `visitor`: página pública aberta sem login (`/v/...`, categoria pública) —
 * no lugar do menu da conta, Entrar e Criar conta, e um convite embaixo da
 * barra.
 */
export function AppShell({
  profile,
  visitor,
  children,
}: {
  profile: Profile | null
  visitor?: VisitorInfo
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <Navbar profile={profile} visitor={visitor} />
      {visitor ? (
        <div className="border-b border-brand-dim/40 bg-brand-wash px-4 py-2 text-center text-sm text-foreground">
          Gostou? Monte a sua vitrine também: catalogue o que você consome e mostre para quem
          quiser.{" "}
          <Link href="/cadastro" className="underline underline-offset-2 hover:text-brand">
            Criar conta
          </Link>
        </div>
      ) : null}
      <main className="shell pb-24">
        {/* Depois do login: o aviso discreto de instalar (só quando o navegador oferece). */}
        {profile && !visitor ? <InstallBanner /> : null}
        {children}
      </main>
    </div>
  )
}
