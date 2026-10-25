import Link from "next/link"
import { Search } from "lucide-react"
import { Suspense, type ReactNode } from "react"

import { AppNav } from "@/components/layout/app-nav"
import { Navbar } from "@/components/layout/navbar"
import { Wordmark } from "@/components/layout/wordmark"
import { InstallBanner } from "@/components/pwa/install"
import { NotificationsBell, UnreadBadge } from "@/components/social/notifications-bell"
import { NotificationsLink } from "@/components/social/notifications-link"
import { defaultVisibilityOf } from "@/lib/domain/privacy"
import type { Profile } from "@/lib/domain/types"
import { displayNameOf } from "@/lib/queries/session"

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
 * Com login: a barra lateral (computador) ou as abas de baixo e o topo com a
 * busca e o sininho (celular) — `AppNav`.
 *
 * `visitor`: página pública aberta sem login (`/v/...`, categoria pública) —
 * a barra de cima com Entrar e Criar conta, e um convite embaixo dela.
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
  if (!profile || visitor) {
    return (
      <div className="min-h-dvh">
        <Navbar visitor={visitor} />
        {visitor ? (
          <div className="border-b border-brand-dim/40 bg-brand-wash px-4 py-2 text-center text-sm text-foreground">
            Gostou? Monte a sua vitrine também: catalogue o que você consome e mostre para quem
            quiser.{" "}
            <Link href="/cadastro" className="underline underline-offset-2 hover:text-brand">
              Criar conta
            </Link>
          </div>
        ) : null}
        <main className="shell pb-24">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh md:flex">
      <AppNav
        me={{
          username: profile.username,
          name: displayNameOf(profile),
          avatarUrl: profile.avatar_url,
          defaultVisibility: defaultVisibilityOf(profile),
        }}
        unread={
          <Suspense fallback={null}>
            <UnreadBadge />
          </Suspense>
        }
      />
      <div className="min-w-0 flex-1">
        {/* O topo do celular: a marca, a busca (o Descobrir) e o sininho. */}
        <header
          className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line px-4 md:hidden"
          style={{
            background: "rgba(18, 18, 20, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <Link
            href="/"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
          >
            <Wordmark />
          </Link>
          <div className="flex items-center">
            <Link
              href="/explorar"
              aria-label="Buscar no Descobrir"
              title="Buscar"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-5" />
            </Link>
            <Suspense fallback={<NotificationsLink count={0} />}>
              <NotificationsBell />
            </Suspense>
          </div>
        </header>
        <main className="shell pb-28 md:pb-12">
          {/* Depois do login: o aviso discreto de instalar (só quando o navegador oferece). */}
          <InstallBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
