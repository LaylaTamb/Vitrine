"use client"

import { Check, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { followAction, unfollowAction } from "@/app/v/actions"
import { Button } from "@/components/ui/button"
import { followButtonLabel } from "@/lib/domain/social"

/**
 * Seguir / Seguindo, com a troca na hora (otimista). Deixar de seguir também
 * é um toque — o aviso traz "Desfazer", para o toque sem querer.
 */
export function FollowButton({
  profileId,
  username,
  following,
  followsMe,
  size = "default",
  onChange,
}: {
  profileId: string
  username: string
  following: boolean
  followsMe: boolean
  size?: "default" | "sm" | "lg"
  /** Avisa quem mostra o selo "Amigos" e as contagens. */
  onChange?: (following: boolean) => void
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const active = optimistic ?? following

  // O dado do servidor chegou: ele manda de novo.
  useEffect(() => {
    setOptimistic(null)
  }, [following])

  async function change(next: boolean, quiet = false) {
    setOptimistic(next)
    onChange?.(next)
    setPending(true)
    const result = next ? await followAction({ profileId }) : await unfollowAction({ profileId })
    setPending(false)
    if (!result.ok) {
      setOptimistic(null)
      onChange?.(!next)
      toast.error(result.error)
      return
    }
    if (quiet) return
    if (next) {
      toast.success(
        followsMe ? `Agora você e @${username} são amigos.` : `Você está seguindo @${username}.`
      )
    } else {
      toast(`Você deixou de seguir @${username}.`, {
        action: { label: "Desfazer", onClick: () => void change(true, true) },
      })
    }
  }

  return (
    <Button
      size={size}
      variant={active ? "outline" : "default"}
      disabled={pending}
      aria-pressed={active}
      onClick={() => change(!active)}
    >
      {active ? <Check className="size-4" /> : <UserPlus className="size-4" />}
      {followButtonLabel({ following: active, followsMe })}
    </Button>
  )
}
