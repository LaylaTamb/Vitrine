"use client"

import { TriangleAlert, UserCheck, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { redeemQrAction } from "@/app/v/actions"
import { redeemMessage, type RedeemMessage } from "@/lib/domain/qr"
import { cn } from "@/lib/utils"

/**
 * O perfil aberto pelo QR de alguém (`/v/ana?qr=…`): usa o código uma vez,
 * tira o código da barra de endereço (recarregar não tenta de novo) e diz o
 * que aconteceu. Fica montado com `token` nulo depois disso — o recado
 * continua na tela quando a página é lida de novo, já com os dois amigos.
 */
export function QrRedeem({ token, path }: { token: string | null; path: string }) {
  const router = useRouter()
  const started = useRef(false)
  const [message, setMessage] = useState<RedeemMessage | null>(null)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    void (async () => {
      const result = await redeemQrAction({ token })
      window.history.replaceState(null, "", path)
      if (!result.ok) {
        setMessage({ title: "Não deu para usar o QR", description: result.error, good: false })
        return
      }
      const { status, username } = result.data ?? { status: "invalid" as const, username: "" }
      setMessage(redeemMessage(status, username))
      // Agora os dois se seguem: o botão, o selo e o que é de Amigos mudam.
      if (status === "friends") router.refresh()
    })()
  }, [token, path, router])

  if (!message) {
    return token ? (
      <p role="status" className="text-sm text-muted-foreground">
        Conferindo o QR…
      </p>
    ) : null
  }

  const Icon = message.good ? UserCheck : TriangleAlert
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-3",
        message.good ? "border-brand-dim bg-brand-wash" : "border-line bg-surface"
      )}
    >
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-5 shrink-0", message.good ? "text-brand" : "text-danger")}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{message.title}</p>
        <p className="text-sm text-muted-foreground">{message.description}</p>
      </div>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Fechar aviso"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
