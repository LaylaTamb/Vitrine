"use client"

import { Download, UserPlus } from "lucide-react"

import { useGuestInvite } from "@/components/guest/guest-invite"
import { Button } from "@/components/ui/button"

/**
 * No topo da categoria vista sem conta: Pegar com os itens e Seguir quem fez,
 * à vista — os dois abrem a janela de convite (modo visitante).
 */
export function GuestCategoryActions({ name, username }: { name: string; username: string }) {
  const invite = useGuestInvite()
  return (
    <>
      <Button size="lg" onClick={() => invite?.({ kind: "take", name })}>
        <Download className="size-4" /> Pegar com os itens
      </Button>
      <Button variant="outline" size="lg" onClick={() => invite?.({ kind: "follow", username })}>
        <UserPlus className="size-4" /> Seguir
      </Button>
    </>
  )
}
