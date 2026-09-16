"use client"

import Link from "next/link"
import { Filter, LogOut, Settings, Tags, User, Users } from "lucide-react"

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
      <DropdownMenuTrigger
        aria-label="Abrir menu da conta"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
      >
        <Avatar name={name} src={avatarUrl} size={32} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="display text-base">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>
            <User className="size-4" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings className="size-4" /> Configurações
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/filtro">
            <Filter className="size-4" /> Filtro geral
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tags">
            <Tags className="size-4" /> Tags
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/usuarios">
            <Users className="size-4" /> Pessoas
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
