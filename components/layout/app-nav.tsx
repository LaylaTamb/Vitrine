"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Compass,
  HeartHandshake,
  House,
  Plus,
  QrCode,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import { AddSheet } from "@/components/layout/add-sheet"
import { Wordmark } from "@/components/layout/wordmark"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { navSectionOf } from "@/lib/domain/nav"
import type { Visibility } from "@/lib/domain/privacy"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

interface Me {
  username: string
  name: string
  avatarUrl: string | null
  defaultVisibility: Visibility
}

/**
 * A navegação do app logado: no computador (e no tablet), a barra lateral com
 * os 5 lugares, o "＋ Adicionar" e as Configurações; no celular, as abas de
 * baixo (Início, Descobrir, ＋, Match e Perfil) — os Avisos ficam no sininho
 * do topo. `unread`: o número do sininho, lido no servidor (num `Suspense`).
 */
export function AppNav({ me, unread }: { me: Me; unread: ReactNode }) {
  const pathname = usePathname()
  const current = navSectionOf(pathname, me.username)
  const [adding, setAdding] = useState(false)
  const profileHref = profilePath(me.username)
  const avatar = (size: number) => <Avatar name={me.name} src={me.avatarUrl} size={size} />

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line px-3 py-5 md:flex lg:w-64">
        <Link
          href="/"
          aria-label="Vitrine — Início"
          className="mb-6 flex items-center px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
        >
          <span className="hidden lg:inline">
            <Wordmark size="lg" />
          </span>
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-brand lg:hidden"
            style={{ boxShadow: "0 0 12px 2px var(--brand-glow)" }}
          />
        </Link>

        <nav aria-label="Principal" className="flex flex-col gap-1">
          <SideItem href="/" icon={House} label="Início" active={current === "inicio"} />
          <SideItem
            href="/explorar"
            icon={Compass}
            label="Descobrir"
            active={current === "descobrir"}
          />
          <SideItem
            href="/matches"
            icon={HeartHandshake}
            label="Match"
            active={current === "match"}
          />
          <SideItem
            href="/avisos"
            icon={Bell}
            label="Avisos"
            active={current === "avisos"}
            badge={unread}
          />
          <SideItem href={profileHref} label="Perfil" active={current === "perfil"}>
            {avatar(26)}
          </SideItem>
          {/* Mostrar o seu QR ou ler o de alguém: escaneou, viram amigos. */}
          <SideItem href="/qr" icon={QrCode} label="QR de amizade" active={current === "qr"} />
        </nav>

        <Button size="lg" className="mt-4 w-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          <span className="hidden lg:inline">Adicionar</span>
          <span className="sr-only lg:hidden">Adicionar</span>
        </Button>

        <div className="mt-auto">
          <SideItem
            href="/configuracoes"
            icon={Settings}
            label="Configurações"
            active={current === "config"}
          />
        </div>
      </aside>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line md:hidden"
        style={{
          background: "rgba(18, 18, 20, 0.94)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <TabItem href="/" icon={House} label="Início" active={current === "inicio"} />
        <TabItem
          href="/explorar"
          icon={Compass}
          label="Descobrir"
          active={current === "descobrir"}
        />
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Adicionar"
          className="flex flex-1 items-center justify-center py-2"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-primary-foreground shadow-lg">
            <Plus className="size-6" />
          </span>
        </button>
        <TabItem href="/matches" icon={HeartHandshake} label="Match" active={current === "match"} />
        {/* No celular, as Configurações moram no Perfil (a engrenagem do cartão). */}
        <TabItem
          href={profileHref}
          label="Perfil"
          active={current === "perfil" || current === "config"}
        >
          {avatar(26)}
        </TabItem>
      </nav>

      <AddSheet open={adding} onOpenChange={setAdding} defaultVisibility={me.defaultVisibility} />
    </>
  )
}

function SideItem({
  href,
  icon: Icon,
  label,
  active,
  badge,
  children,
}: {
  href: string
  icon?: LucideIcon
  label: string
  active: boolean
  badge?: ReactNode
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors",
        active
          ? "bg-brand-wash text-foreground"
          : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
      )}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        {Icon ? <Icon aria-hidden className={cn("size-5", active && "text-brand")} /> : children}
        {badge}
      </span>
      <span className="hidden lg:inline">{label}</span>
      <span className="sr-only lg:hidden">{label}</span>
    </Link>
  )
}

function TabItem({
  href,
  icon: Icon,
  label,
  active,
  children,
}: {
  href: string
  icon?: LucideIcon
  label: string
  active: boolean
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem]",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={cn("size-6", active && "text-brand")} />
      ) : (
        <span className={cn("rounded-full", active && "ring-2 ring-brand")}>{children}</span>
      )}
      <span>{label}</span>
    </Link>
  )
}
