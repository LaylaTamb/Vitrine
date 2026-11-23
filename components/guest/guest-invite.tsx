"use client"

import Link from "next/link"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authHref } from "@/lib/domain/auth"
import { inviteCopy, type InviteReason } from "@/lib/domain/guest"

type Invite = (reason: InviteReason) => void

const GuestInviteContext = createContext<Invite | null>(null)

/**
 * Dentro da casca do visitante (sem conta): a função que abre a janela de
 * convite. Fora dela (com conta), `null` — o componente segue com a ação de
 * verdade. Ex.: o Seguir chama `invite({ kind: "follow", username })` se houver.
 */
export function useGuestInvite(): Invite | null {
  return useContext(GuestInviteContext)
}

/**
 * Dá o `useGuestInvite` às telas do visitante e desenha a janela: o texto da
 * ação (`inviteCopy`), Criar conta e Entrar — os dois voltam para esta mesma
 * tela depois — e "Agora não". Nada bloqueia: fechou, segue navegando.
 */
export function GuestInviteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ reason: InviteReason; next: string } | null>(null)

  // A tela de agora, lida no toque: é para onde Criar conta e Entrar voltam.
  const invite = useCallback<Invite>((reason) => {
    setOpen({ reason, next: `${window.location.pathname}${window.location.search}` })
  }, [])
  const copy = useMemo(() => (open ? inviteCopy(open.reason) : null), [open])

  return (
    <GuestInviteContext.Provider value={invite}>
      {children}
      <Dialog open={open !== null} onOpenChange={(next) => (next ? null : setOpen(null))}>
        <DialogContent className="gap-5 text-center max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-sm">
          {copy && open ? (
            <>
              <DialogHeader className="items-center text-center sm:text-center">
                <span aria-hidden className="text-4xl leading-none">
                  {copy.icon}
                </span>
                <DialogTitle className="display text-[1.6rem] leading-tight [overflow-wrap:anywhere]">
                  {copy.title}
                </DialogTitle>
                <DialogDescription>{copy.text}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Link
                  href={authHref("/cadastro", open.next)}
                  onClick={() => setOpen(null)}
                  className={buttonVariants({ size: "lg" })}
                >
                  Criar conta
                </Link>
                <Link
                  href={authHref("/login", open.next)}
                  onClick={() => setOpen(null)}
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Já tenho conta — Entrar
                </Link>
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Agora não
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </GuestInviteContext.Provider>
  )
}
