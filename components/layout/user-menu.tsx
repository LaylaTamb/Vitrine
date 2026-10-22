"use client"

import Link from "next/link"
import {
  Compass,
  Filter,
  HeartHandshake,
  Library,
  LogOut,
  MapIcon,
  QrCode,
  Settings,
  Tags,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useSyncExternalStore } from "react"

import { signOutAction } from "@/app/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar } from "@/components/ui/avatar-image"
import { profilePath } from "@/lib/domain/username"

/** Os links da barra de cima — que no celular (abaixo de 768 px) ela esconde. */
const MOBILE_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/filtro", label: "Filtro geral", icon: Filter },
  { href: "/mapa", label: "Mapa", icon: MapIcon },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/usuarios", label: "Pessoas", icon: Users },
]

/** O mesmo corte do `md:` do Tailwind, que mostra a barra de links. */
const MOBILE_QUERY = "(max-width: 767.98px)"

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * Celular? Só no navegador (no servidor, não). Melhor que esconder com
 * `md:hidden`: item escondido ainda entraria na navegação pelas setas.
 */
function useMobileNav(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

/**
 * O menu da conta: o seu perfil, as suas Coleções, o QR, os Matches, as
 * Configurações e Sair. O que já está na barra de cima não se repete (só no
 * celular, onde a barra não mostra os links).
 */
export function UserMenu({
  name,
  username,
  avatarUrl,
}: {
  name: string
  username: string
  avatarUrl: string | null
}) {
  const mobile = useMobileNav()

  return (
    <DropdownMenu>
      {/* O @ fica sempre à vista: é por ele que as pessoas se acham. */}
      <DropdownMenuTrigger
        aria-label={`Abrir menu da conta @${username}`}
        className="flex min-w-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
      >
        <span className="max-w-[10rem] truncate text-sm text-muted-foreground">@{username}</span>
        <Avatar name={name} src={avatarUrl} size={32} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="display text-base">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={profilePath(username)}>
            <User className="size-4" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">
            <Library className="size-4" /> Coleções
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/qr">
            <QrCode className="size-4" /> Meu QR
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/matches">
            <HeartHandshake className="size-4" /> Matches
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings className="size-4" /> Configurações
          </Link>
        </DropdownMenuItem>

        {/* No celular a barra de cima não tem os links: eles vêm aqui. */}
        {mobile ? (
          <>
            <DropdownMenuSeparator />
            {MOBILE_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>
                  <link.icon className="size-4" /> {link.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}

        <DropdownMenuSeparator />

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none hover:bg-surface-hi"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
