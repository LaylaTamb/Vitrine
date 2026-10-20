"use client"

import Link from "next/link"
import { Ban, Ellipsis, HeartHandshake, QrCode, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { blockAction, unblockAction } from "@/app/v/actions"
import { NewMatchDialog } from "@/components/match/new-match-dialog"
import { FollowButton } from "@/components/social/follow-button"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { areFriends } from "@/lib/domain/social"
import { profilePath } from "@/lib/domain/username"
import type { ProfileSocial } from "@/lib/queries/social"

/**
 * A faixa social do perfil (`/v/...`): seguidores e seguindo (com as
 * listas), o selo "Amigos" quando os dois se seguem, o botão de seguir e o
 * menu com Bloquear. No próprio perfil, as contagens e o atalho do QR.
 */
export function ProfileSocialBar({
  profileId,
  username,
  social,
  isMe,
}: {
  profileId: string
  username: string
  social: ProfileSocial
  isMe: boolean
}) {
  const [following, setFollowing] = useState(social.iFollow)
  const [blocking, setBlocking] = useState(false)
  const [matching, setMatching] = useState(false)
  const [pending, setPending] = useState(false)
  // Seguir/deixar de seguir mexe na contagem de seguidores desta pessoa.
  const followers = social.followers + (following === social.iFollow ? 0 : following ? 1 : -1)
  const friends = areFriends({ following, followsMe: social.followsMe })
  const path = profilePath(username)

  async function unblock() {
    setPending(true)
    const result = await unblockAction({ profileId })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`@${username} foi desbloqueado(a).`)
  }

  if (social.iBlocked) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-hi px-3 py-2.5 text-sm">
        <Ban aria-hidden className="size-4 shrink-0 text-danger" />
        <p className="min-w-[12rem] flex-1 text-muted-foreground">
          Você bloqueou @{username}: um não vê nada do outro, nem o que é público.
        </p>
        <Button size="sm" variant="outline" disabled={pending} onClick={unblock}>
          Desbloquear
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-4 text-sm">
        <Link href={`${path}/seguidores`} className="text-muted-foreground hover:text-foreground">
          <span className="text-foreground">{followers.toLocaleString("pt-BR")}</span>{" "}
          {followers === 1 ? "seguidor" : "seguidores"}
        </Link>
        <Link href={`${path}/seguindo`} className="text-muted-foreground hover:text-foreground">
          <span className="text-foreground">{social.following.toLocaleString("pt-BR")}</span>{" "}
          seguindo
        </Link>
      </div>

      {friends ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-dim bg-brand-wash px-2.5 py-0.5 text-xs text-foreground">
          <Users aria-hidden className="size-3.5 text-brand" /> Amigos
        </span>
      ) : !isMe && social.followsMe ? (
        <span className="text-xs text-muted-foreground">Segue você</span>
      ) : null}

      {isMe ? (
        <Link href="/qr" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <QrCode className="size-4" /> Meu QR
        </Link>
      ) : (
        <div className="flex items-center gap-1.5">
          <FollowButton
            profileId={profileId}
            username={username}
            following={social.iFollow}
            followsMe={social.followsMe}
            onChange={setFollowing}
          />
          {/* Match só com amigos: com eles, o atalho fica aqui mesmo. */}
          {friends ? (
            <Button variant="outline" size="sm" onClick={() => setMatching(true)}>
              <HeartHandshake className="size-4" /> Match
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Mais opções para @${username}`}>
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              collisionPadding={12}
              className="w-auto max-w-[calc(100vw-1.5rem)]"
            >
              <DropdownMenuItem variant="destructive" onSelect={() => setBlocking(true)}>
                <Ban className="size-4" />
                <span className="truncate">Bloquear @{username}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {friends && !isMe ? (
        <NewMatchDialog open={matching} onOpenChange={setMatching} preselected={[profileId]} />
      ) : null}

      <ConfirmDialog
        open={blocking}
        onOpenChange={setBlocking}
        title={`Bloquear @${username}`}
        description={
          <>
            <p>
              Vocês deixam de se seguir, e um não vê nada do outro — nem o que é público. @
              {username} não é avisado(a).
            </p>
            <p>Dá para desbloquear depois, aqui mesmo no perfil.</p>
          </>
        }
        confirmLabel="Bloquear"
        pendingLabel="Bloqueando…"
        onConfirm={async () => {
          const result = await blockAction({ profileId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success(`@${username} foi bloqueado(a).`)
        }}
      />
    </div>
  )
}

/** Para quem abre o perfil sem conta: o convite para seguir (que leva ao login). */
export function VisitorFollowInvite({ username }: { username: string }) {
  const path = profilePath(username)
  return (
    <div>
      <Link
        href={`/login?proximo=${encodeURIComponent(path)}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Entre para seguir @{username} e ver as coleções de amigos
      </Link>
    </div>
  )
}
