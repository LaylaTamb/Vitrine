"use client"

import Link from "next/link"
import { Check, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { createMatchAction, matchFriendsAction } from "@/app/matches/actions"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { plural } from "@/lib/domain/format"
import { MAX_MATCH_INVITES } from "@/lib/domain/match"
import { normalizeName } from "@/lib/domain/fields"
import type { ListProfile } from "@/lib/queries/social"
import { cn } from "@/lib/utils"

/**
 * "Novo match": escolher até 7 amigos (quem você segue e segue você de
 * volta). `friends` nulo = carrega ao abrir (no perfil de alguém);
 * `preselected` já vem marcado (o amigo cujo perfil está aberto).
 */
export function NewMatchDialog({
  open,
  onOpenChange,
  friends: initialFriends = null,
  preselected = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  friends?: ListProfile[] | null
  preselected?: string[]
}) {
  const router = useRouter()
  const [friends, setFriends] = useState<ListProfile[] | null>(initialFriends)
  const [selected, setSelected] = useState<string[]>(preselected)
  const [query, setQuery] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open || friends !== null) return
    let alive = true
    void matchFriendsAction().then((result) => {
      if (alive) setFriends(result.ok && result.data ? result.data : [])
    })
    return () => {
      alive = false
    }
  }, [open, friends])

  const full = selected.length >= MAX_MATCH_INVITES
  const needle = normalizeName(query)
  const visible = (friends ?? []).filter(
    (friend) =>
      !needle ||
      normalizeName(friend.username).includes(needle) ||
      normalizeName(friend.display_name ?? "").includes(needle)
  )

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_MATCH_INVITES
          ? current
          : [...current, id]
    )
  }

  async function create() {
    setPending(true)
    const result = await createMatchAction({ userIds: selected })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      selected.length === 1
        ? "Convite enviado. Quando aceitarem, o match fica pronto."
        : "Convites enviados. Quando todos aceitarem, o match fica pronto."
    )
    onOpenChange(false)
    setSelected([])
    router.push("/matches")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="display text-xl">Novo match</DialogTitle>
          <DialogDescription>
            Compare as coleções com até {MAX_MATCH_INVITES} amigos. Todo mundo precisa aceitar; se
            alguém recusar, o match é cancelado.
          </DialogDescription>
        </DialogHeader>

        {friends === null ? (
          <p className="text-sm text-muted-foreground">Carregando os seus amigos…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não tem amigos por aqui — amigos são quem você segue e segue você de volta.{" "}
            <Link href="/usuarios" className="text-foreground underline underline-offset-2">
              Ver Pessoas
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {friends.length > 6 ? (
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar amigo"
                  aria-label="Buscar amigo"
                  className="pl-9"
                />
              </div>
            ) : null}
            <ul className="max-h-[45vh] space-y-1 overflow-y-auto">
              {visible.map((friend) => {
                const checked = selected.includes(friend.id)
                return (
                  <li key={friend.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(friend.id)}
                      disabled={!checked && full}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-50",
                        checked
                          ? "border-brand-dim bg-brand-wash"
                          : "border-line hover:border-brand-dim"
                      )}
                    >
                      <Avatar
                        name={friend.display_name || friend.username}
                        src={friend.avatar_url}
                        size={32}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {friend.display_name || friend.username}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{friend.username}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border",
                          checked ? "border-brand bg-brand text-primary-foreground" : "border-line"
                        )}
                      >
                        {checked ? <Check className="size-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {full ? (
              <p className="text-xs text-faint">
                Cheio: {MAX_MATCH_INVITES} amigos é o máximo (8 pessoas com você).
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="items-center justify-between sm:justify-between">
          <span className="text-xs text-faint">
            {selected.length === 0 ? "Ninguém escolhido" : plural(selected.length, "amigo", "amigos")}
          </span>
          <Button onClick={create} disabled={pending || selected.length === 0}>
            {pending ? "Enviando…" : "Chamar para o match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
