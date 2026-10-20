"use client"

import Link from "next/link"
import { UserMinus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { removeFollowerAction } from "@/app/v/actions"
import { FollowButton } from "@/components/social/follow-button"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { profilePath } from "@/lib/domain/username"

/**
 * Uma pessoa numa lista (Pessoas, seguidores, seguindo): avatar, nome e @
 * (o link para o perfil) e, à direita, Seguir — e, na lista dos SEUS
 * seguidores, Remover.
 */
export function PersonRow({
  person,
  isMe,
  following,
  followsMe,
  removable = false,
}: {
  person: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  /** É a própria pessoa logada: sem botões. */
  isMe: boolean
  following: boolean
  followsMe: boolean
  /** Na lista dos meus seguidores: "Remover" tira a pessoa de lá (sem bloquear). */
  removable?: boolean
}) {
  const [removed, setRemoved] = useState(false)
  const [pending, setPending] = useState(false)
  const name = person.display_name || person.username

  if (removed) return null

  async function remove() {
    setPending(true)
    const result = await removeFollowerAction({ profileId: person.id })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setRemoved(true)
    toast.success(`@${person.username} não segue mais você.`)
  }

  const relation = isMe
    ? ""
    : following && followsMe
      ? " · Amigos"
      : followsMe
        ? " · Segue você"
        : ""

  return (
    <li className="vitrine-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <Link
        href={profilePath(person.username)}
        className="flex min-w-[10rem] flex-1 items-center gap-3"
      >
        <Avatar name={name} src={person.avatar_url} size={36} />
        <span className="min-w-0">
          <span className="display block truncate text-base">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            @{person.username}
            {relation}
          </span>
        </span>
      </Link>
      {isMe ? (
        <span className="shrink-0 text-xs text-faint">Você</span>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {removable ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={remove}
              title={`Remover @${person.username} dos seus seguidores`}
            >
              <UserMinus className="size-3.5" /> Remover
            </Button>
          ) : null}
          <FollowButton
            size="sm"
            profileId={person.id}
            username={person.username}
            following={following}
            followsMe={followsMe}
          />
        </div>
      )}
    </li>
  )
}
