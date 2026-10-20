"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { listNotificationsAction, markNotificationsReadAction } from "@/app/v/actions"
import { Avatar } from "@/components/ui/avatar-image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  notificationHref,
  notificationText,
  timeAgo,
  type NotificationView,
} from "@/lib/domain/social"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

/**
 * O sininho da barra. O número de não lidas chega pronto do servidor; a lista
 * só é buscada ao abrir — e abrir marca tudo como lido (o ponto roxo some na
 * próxima vez).
 */
export function NotificationsMenu({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [items, setItems] = useState<NotificationView[] | null>(null)
  const [now, setNow] = useState(() => new Date())

  async function load() {
    setNow(new Date())
    const result = await listNotificationsAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setItems(result.data ?? [])
    if (count > 0 || (result.data ?? []).some((item) => !item.read_at)) {
      setCount(0)
      void markNotificationsReadAction()
    }
  }

  const label =
    count > 0
      ? `Notificações: ${count} ${count === 1 ? "nova" : "novas"}`
      : "Notificações"

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load()
      }}
    >
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className="relative rounded-full p-2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-dim"
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] leading-4 font-medium text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)]"
      >
        <DropdownMenuLabel className="display text-base">Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items === null ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Nada por aqui ainda. Quando alguém seguir você, aparece aqui.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link
                  href={notificationHref(item, profilePath)}
                  className="flex items-start gap-2.5 py-2"
                >
                  <Avatar
                    name={item.actor?.display_name || item.actor?.username || "?"}
                    src={item.actor?.avatar_url ?? null}
                    size={28}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug whitespace-normal text-foreground">
                      {notificationText(item)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(item.created_at, now)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.read_at ? "bg-transparent" : "bg-brand"
                    )}
                  />
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
