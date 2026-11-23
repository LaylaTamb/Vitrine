"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRight,
  Clapperboard,
  HeartHandshake,
  House,
  LayoutGrid,
  LogIn,
  MapIcon,
  MapPin,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { useGuestInvite } from "@/components/guest/guest-invite"
import { SideItem, TabItem } from "@/components/layout/app-nav"
import { Wordmark } from "@/components/layout/wordmark"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authHref } from "@/lib/domain/auth"

/** O que o visitante vê como "o Início": as Sugestões e o que se abre delas. */
const BROWSING = ["/inicio", "/explorar", "/v", "/categoria"]

function underAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * A navegação de quem não tem conta: a mesma do app (barra lateral a partir de
 * 768 px, abas de baixo no celular), com Início, Match, ＋ e Mapa; no lugar do
 * Perfil, Entrar. Match e Mapa abrem as amostras (`/matches` e `/mapa`); o ＋,
 * a lista do que dá para adicionar, que leva ao convite. `next`: esta tela,
 * para Entrar e Criar conta voltarem para cá.
 */
export function GuestNav({ next }: { next: string }) {
  const pathname = usePathname()
  const [adding, setAdding] = useState(false)
  const browsing = underAny(pathname, BROWSING)
  const add = () => setAdding(true)

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line px-3 py-5 md:flex lg:w-64">
        <Link
          href="/"
          aria-label="Vitrine — boas-vindas"
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
          <SideItem href="/inicio?aba=sugestoes" icon={House} label="Início" active={browsing} />
          <SideItem
            href="/matches"
            icon={HeartHandshake}
            label="Match"
            active={pathname === "/matches"}
          />
          <SideItem href="/mapa" icon={MapIcon} label="Mapa" active={pathname === "/mapa"} />
        </nav>

        <Button size="lg" className="mt-4 w-full" onClick={add}>
          <Plus className="size-4" />
          <span className="hidden lg:inline">Adicionar</span>
          <span className="sr-only lg:hidden">Adicionar</span>
        </Button>

        <div className="mt-auto grid gap-2">
          <Link
            href={authHref("/cadastro", next)}
            className={buttonVariants({ size: "lg" })}
            title="Criar conta"
          >
            <UserPlus className="size-4" />
            <span className="hidden lg:inline">Criar conta</span>
            <span className="sr-only lg:hidden">Criar conta</span>
          </Link>
          <Link
            href={authHref("/login", next)}
            className={buttonVariants({ variant: "outline", size: "lg" })}
            title="Entrar"
          >
            <LogIn className="size-4" />
            <span className="hidden lg:inline">Entrar</span>
            <span className="sr-only lg:hidden">Entrar</span>
          </Link>
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
        <TabItem href="/inicio?aba=sugestoes" icon={House} label="Início" active={browsing} />
        <TabItem
          href="/matches"
          icon={HeartHandshake}
          label="Match"
          active={pathname === "/matches"}
        />
        <button
          type="button"
          onClick={add}
          aria-label="Adicionar"
          className="flex flex-1 items-center justify-center py-2"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-primary-foreground shadow-lg">
            <Plus className="size-6" />
          </span>
        </button>
        <TabItem href="/mapa" icon={MapIcon} label="Mapa" active={pathname === "/mapa"} />
        <TabItem href={authHref("/login", next)} icon={LogIn} label="Entrar" active={false} />
      </nav>

      <GuestAddSheet open={adding} onOpenChange={setAdding} />
    </>
  )
}

/** O que o ＋ mostra ao visitante: o mesmo que o app oferece, cada um levando ao convite. */
const ADD_OPTIONS: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: Sparkles, label: "Item", hint: "O restaurante de ontem, o livro que você terminou" },
  { icon: LayoutGrid, label: "Categoria", hint: "Com os campos que você quiser" },
  { icon: MapPin, label: "Trazer do Google Maps", hint: "As listas salvas viram categorias" },
  { icon: Clapperboard, label: "Letterboxd e Steam", hint: "Os filmes e os jogos chegam sozinhos" },
]

/** A amostra do ＋ Adicionar: a lista do que dá para fazer com uma conta. */
function GuestAddSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const invite = useGuestInvite()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-5 overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-2xl">Adicionar</DialogTitle>
          <DialogDescription>Tudo isto fica com você depois de criar a conta.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {ADD_OPTIONS.map((option) => (
            <li key={option.label}>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  invite?.({ kind: "add" })
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi"
              >
                <option.icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

/** O topo do celular do visitante: a marca, a busca (as Sugestões) e Entrar. */
export function GuestTopBar({ next }: { next: string }) {
  return (
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
      <div className="flex items-center gap-1">
        <Link
          href="/inicio?aba=sugestoes&buscar=1"
          aria-label="Buscar pessoas e categorias"
          title="Buscar"
          className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="size-5" />
        </Link>
        <Link
          href={authHref("/login", next)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Entrar
        </Link>
      </div>
    </header>
  )
}

const BANNER_KEY = "vitrine:visitante:faixa"

/**
 * A faixa fina do visitante: "Monte a sua vitrine" com Criar conta. Fecha no
 * × até a próxima visita (`sessionStorage`, que pode falhar: aí ela só fica).
 * Começa escondida e aparece depois de montar — o servidor não sabe se ela
 * foi fechada.
 */
export function GuestBanner({ next }: { next: string }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    try {
      setShown(sessionStorage.getItem(BANNER_KEY) !== "fechada")
    } catch {
      setShown(true)
    }
  }, [])

  function close() {
    setShown(false)
    try {
      sessionStorage.setItem(BANNER_KEY, "fechada")
    } catch {
      // Sem armazenamento: fecha só agora.
    }
  }

  if (!shown) return null
  return (
    <div className="flex items-center gap-2.5 border-b border-brand-dim/40 bg-brand-wash py-2 pr-2 pl-4 text-sm">
      <p className="min-w-0 flex-1">
        Você está como visitante. <span className="font-medium">Monte a sua vitrine</span>, é
        grátis.
      </p>
      <Link href={authHref("/cadastro", next)} className={buttonVariants({ size: "sm" })}>
        Criar conta
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Fechar o aviso"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
