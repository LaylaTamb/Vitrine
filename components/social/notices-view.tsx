"use client"

import Link from "next/link"
import { Bell, Check, FileUp, HeartHandshake } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { respondMatchAction } from "@/app/matches/actions"
import { markNotificationsReadAction } from "@/app/v/actions"
import { EmptyState } from "@/components/layout/empty-state"
import { FollowButton } from "@/components/social/follow-button"
import { Avatar } from "@/components/ui/avatar-image"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  notificationHref,
  notificationText,
  timeAgo,
  type NotificationView,
} from "@/lib/domain/social"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

/**
 * Os Avisos: a lista inteira, com a ação no próprio aviso — Seguir de volta,
 * Aceitar o match, Ver a importação — sem abrir outra tela. Abrir a página
 * marca tudo como lido (o destaque fica até sair dela).
 */
export function NoticesView({
  items,
  following,
  pendingInvites,
  now,
}: {
  items: NotificationView[]
  /** Os ids de quem você segue: o "Seguir de volta" só aparece para quem falta. */
  following: string[]
  /** Os matches que ainda esperam a sua resposta: só eles ganham o "Aceitar". */
  pendingInvites: string[]
  /** A hora do servidor: o "há 5 min" sai igual no HTML e na tela. */
  now: string
}) {
  const router = useRouter()
  const hasUnread = items.some((item) => !item.read_at)

  // Marca como lido e relê a barra (o número do sininho zera).
  useEffect(() => {
    if (!hasUnread) return
    void markNotificationsReadAction().then(() => router.refresh())
  }, [hasUnread, router])

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nada por aqui ainda"
        description="Quando alguém seguir você, chamar para um match ou uma importação terminar, aparece aqui."
      />
    )
  }

  const nowDate = new Date(now)
  return (
    <ul className="mb-16 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((item) => {
        const action = noticeAction(item, following, pendingInvites)
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 p-4 sm:items-center",
              !item.read_at && "bg-brand-wash/40"
            )}
          >
            <NoticeIcon item={item} />
            {/* No celular, a ação desce para baixo do texto, alinhada com ele. */}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Link
                href={notificationHref(item, profilePath)}
                className="min-w-0 self-stretch hover:opacity-90 sm:flex-1"
              >
                <span className="block text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
                  {notificationText(item)}
                </span>
                <span className="block text-xs text-faint">
                  {timeAgo(item.created_at, nowDate)}
                </span>
              </Link>
              {action ? <div className="shrink-0">{action}</div> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function NoticeIcon({ item }: { item: NotificationView }) {
  if (item.actor) {
    return (
      <Avatar
        name={item.actor.display_name || item.actor.username}
        src={item.actor.avatar_url}
        size={40}
      />
    )
  }
  const Icon =
    item.type === "import_done" ? FileUp : item.type.startsWith("match_") ? HeartHandshake : Bell
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hi">
      <Icon aria-hidden className="size-5 text-brand" />
    </span>
  )
}

/** A ação de cada tipo (quando ainda faz sentido); `null` = nenhuma. */
function noticeAction(
  item: NotificationView,
  following: string[],
  pendingInvites: string[]
): ReactNode {
  const actor = item.actor
  if (item.type === "new_follower" && actor?.id && !following.includes(actor.id)) {
    return (
      <FollowButton
        size="sm"
        profileId={actor.id}
        username={actor.username}
        following={false}
        followsMe
      />
    )
  }
  const matchId = typeof item.payload.match_id === "string" ? item.payload.match_id : null
  if (item.type === "match_invite" && matchId && pendingInvites.includes(matchId)) {
    return <AcceptMatch matchId={matchId} />
  }
  if (item.type === "import_done" || item.type === "match_ready") {
    return (
      <Link
        href={notificationHref(item, profilePath)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {item.type === "match_ready" ? "Abrir" : "Ver"}
      </Link>
    )
  }
  return null
}

function AcceptMatch({ matchId }: { matchId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function accept() {
    setPending(true)
    const result = await respondMatchAction({ matchId, accept: true })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setDone(true)
    toast.success(
      result.data?.status === "ready"
        ? "Todo mundo aceitou: o match está pronto!"
        : "Aceito. Falta o resto da turma responder."
    )
    router.refresh()
  }

  if (done) {
    return (
      <Link href="/matches" className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Check className="size-4" /> Ver o match
      </Link>
    )
  }
  return (
    <Button size="sm" onClick={accept} disabled={pending}>
      {pending ? "Aceitando…" : "Aceitar"}
    </Button>
  )
}
