"use client"

import Link from "next/link"
import {
  Compass,
  Filter,
  HeartHandshake,
  LogOut,
  MapIcon,
  QrCode,
  Settings,
  Star,
  Tags,
  User,
  Users,
} from "lucide-react"

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

export function UserMenu({
  name,
  username,
  avatarUrl,
}: {
  name: string
  username: string
  avatarUrl: string | null
}) {
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
          <Link href="/qr">
            <QrCode className="size-4" /> Meu QR
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings className="size-4" /> Configurações
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/explorar">
            <Compass className="size-4" /> Explorar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/filtro">
            <Filter className="size-4" /> Filtro geral
          </Link>
        </DropdownMenuItem>
        {/* O menu da conta não existe na demonstração — o Mapa também não. */}
        <DropdownMenuItem asChild>
          <Link href="/mapa">
            <MapIcon className="size-4" /> Mapa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tags">
            <Tags className="size-4" /> Tags
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/favoritos">
            <Star className="size-4" /> Favoritos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/usuarios">
            <Users className="size-4" /> Pessoas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/matches">
            <HeartHandshake className="size-4" /> Matches
          </Link>
        </DropdownMenuItem>

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
