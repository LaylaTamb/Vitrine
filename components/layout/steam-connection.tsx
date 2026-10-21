"use client"

import Link from "next/link"
import { Gamepad2, RefreshCw, TriangleAlert, Unplug } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { disconnectSteamAction, syncSteamNowAction } from "@/app/configuracoes/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { STEAM_NOT_READY } from "@/lib/domain/steam"
import type { SteamAccountView } from "@/lib/queries/connected"
import { cn } from "@/lib/utils"

const NOTE = "rounded-lg border border-line bg-surface-hi px-3 py-2.5 text-sm text-muted-foreground"

/**
 * A Steam no Meu perfil (Editar cartão): conectar (login da própria Steam), sincronizar
 * agora, ver os jogos e desconectar. A sincronização também roda sozinha uma
 * vez por dia.
 */
export function SteamConnection({
  ready,
  configured,
  account,
  syncedLabel,
  notice,
}: {
  /** A migração 24 já rodou? */
  ready: boolean
  /** STEAM_API_KEY e CRON_SECRET no servidor? */
  configured: boolean
  account: SteamAccountView | null
  /** "atualizada há 3 h", calculado no servidor (sem diferença na hidratação). */
  syncedLabel: string
  /** O recado da volta do login (`?steam=`). */
  notice: { text: string; good: boolean } | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // O recado da volta igual ao erro gravado (perfil privado): aparece uma vez só.
  const shownNotice = notice && notice.text !== account?.lastError ? notice : null

  async function syncNow() {
    setPending(true)
    const result = await syncSteamNowAction()
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      toast.success(result.data?.summary ?? "Steam sincronizada.")
    }
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
          <Gamepad2 aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Steam</p>
          <p className="truncate text-xs text-muted-foreground">
            {account
              ? `Conectada como ${account.displayName ?? "sua conta"} · ${syncedLabel}`
              : "Não conectada"}
          </p>
        </div>
      </div>

      {shownNotice ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            shownNotice.good
              ? "border-brand-dim bg-brand-wash text-foreground"
              : "border-line bg-surface-hi text-muted-foreground"
          )}
        >
          {shownNotice.text}
        </p>
      ) : null}

      {!ready ? (
        <p className={NOTE}>{STEAM_NOT_READY}</p>
      ) : account ? (
        <>
          {account.lastError ? (
            <p className="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{account.lastError}</span>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Seus jogos ficam numa categoria da pasta “Steam”, com as horas jogadas, e são
            atualizados sozinhos uma vez por dia. Nome, nota e imagem são seus: a sincronização só
            mexe nas horas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={syncNow} disabled={pending || !configured}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              {pending ? "Sincronizando…" : "Sincronizar agora"}
            </Button>
            {account.categoryId ? (
              <Link
                href={`/categoria/${account.categoryId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Ver os jogos
              </Link>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setConfirming(true)}
            >
              <Unplug className="size-4" /> Desconectar
            </Button>
          </div>
        </>
      ) : !configured ? (
        <p className={NOTE}>
          A conexão com a Steam ainda não foi ativada neste Vitrine (faltam a STEAM_API_KEY e o
          CRON_SECRET no servidor).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Traz seus jogos para uma categoria “Jogos” (na pasta “Steam”), com as horas jogadas, e
            atualiza sozinho uma vez por dia. Você entra pela própria Steam: a senha não passa pelo
            Vitrine.
          </p>
          {/* Link de verdade (não <Link>): a rota redireciona para fora, para a Steam. */}
          <a href="/api/steam/conectar" className={buttonVariants({ size: "sm" })}>
            <Gamepad2 className="size-4" /> Conectar Steam
          </a>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Desconectar a Steam"
        description={
          <p>
            Os jogos que já vieram continuam na sua categoria, só param de ser atualizados. Dá para
            conectar de novo quando quiser.
          </p>
        }
        confirmLabel="Desconectar"
        pendingLabel="Desconectando…"
        onConfirm={async () => {
          const result = await disconnectSteamAction()
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          setConfirming(false)
          toast.success("Steam desconectada.")
          router.refresh()
        }}
      />
    </div>
  )
}
