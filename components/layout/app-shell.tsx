import Link from "next/link"
import { QrCode, Search } from "lucide-react"
import { Suspense, type ReactNode } from "react"

import { GuestInviteProvider } from "@/components/guest/guest-invite"
import { GuestBanner, GuestNav, GuestTopBar } from "@/components/guest/guest-nav"
import { AppNav } from "@/components/layout/app-nav"
import { Navbar } from "@/components/layout/navbar"
import { Wordmark } from "@/components/layout/wordmark"
import { InstallBanner } from "@/components/pwa/install"
import { UnreadBadge } from "@/components/social/notifications-bell"
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
 * busca e o QR (celular) — `AppNav`.
 *
 * `visitor`: página aberta sem login (modo visitante: o Início, `/v/...`, a
 * categoria pública) — a navegação do visitante (`GuestNav`), a faixa "Monte
 * a sua vitrine" e a janela de convite (`useGuestInvite`). `next`: esta
 * tela, para onde Entrar e Criar conta voltam.
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
  // Sem conta (modo visitante): a mesma casa do app, com a navegação do
  // visitante, a faixa "Monte a sua vitrine" e a janela de convite.
  if (visitor) {
    return (
      <GuestInviteProvider>
        <div className="min-h-dvh md:flex">
          <GuestNav next={visitor.next} />
          <div className="min-w-0 flex-1">
            <GuestTopBar next={visitor.next} />
            <GuestBanner next={visitor.next} />
            <main className="shell pb-28 md:pb-12">{children}</main>
          </div>
        </div>
      </GuestInviteProvider>
    )
  }

  // Conta sem perfil (cadastro incompleto): só a barra de cima, com a marca.
  if (!profile) {
    return (
      <div className="min-h-dvh">
        <Navbar />
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
        {/* O topo do celular: a marca, a busca (as Sugestões do Início) e o QR de amizade. Os Avisos ficam nas abas de baixo. */}
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
              href="/inicio?aba=sugestoes&buscar=1"
              aria-label="Buscar pessoas e categorias"
              title="Buscar"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-5" />
            </Link>
            <Link
              href="/qr"
              aria-label="QR de amizade"
              title="QR de amizade"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <QrCode className="size-5" />
            </Link>
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
