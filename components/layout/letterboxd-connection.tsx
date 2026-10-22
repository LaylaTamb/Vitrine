"use client"

import Link from "next/link"
import { Clapperboard, RefreshCw, TriangleAlert, Unplug } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  connectLetterboxdAction,
  disconnectLetterboxdAction,
  syncLetterboxdNowAction,
} from "@/app/configuracoes/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { LETTERBOXD_NOT_READY } from "@/lib/domain/connected"
import type { ConnectedAccountView } from "@/lib/queries/connected"
import { cn } from "@/lib/utils"

const NOTE = "rounded-lg border border-line bg-surface-hi px-3 py-2.5 text-sm text-muted-foreground"

/**
 * O Letterboxd no Meu perfil (Editar cartão): conectar pelo @ (o feed público
 * do perfil — sem senha), sincronizar agora, ver os filmes e desconectar. Também
 * atualiza sozinho uma vez por dia e ao abrir a categoria (passada 1 hora).
 */
export function LetterboxdConnection({
  ready,
  configured,
  account,
  syncedLabel,
}: {
  /** A migração 24 já rodou? (A 39, quem avisa é o conectar.) */
  ready: boolean
  /** CRON_SECRET no servidor? */
  configured: boolean
  account: ConnectedAccountView | null
  /** "atualizada há 3 h", calculado no servidor (sem diferença na hidratação). */
  syncedLabel: string
}) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    const result = await connectLetterboxdAction({ username })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setUsername("")
    const categoryId = result.data?.categoryId ?? null
    toast.success(result.data?.summary ?? "Letterboxd conectado.", {
      action: categoryId
        ? { label: "Ver", onClick: () => router.push(`/categoria/${categoryId}`) }
        : undefined,
    })
    router.refresh()
  }

  async function syncNow() {
    setPending(true)
    const result = await syncLetterboxdNowAction()
    setPending(false)
    if (!result.ok) toast.error(result.error)
    else toast.success(result.data?.summary ?? "Letterboxd sincronizado.")
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
          <Clapperboard aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Letterboxd</p>
          <p className="truncate text-xs text-muted-foreground">
            {account ? `Conectado como @${account.externalId} · ${syncedLabel}` : "Não conectado"}
          </p>
        </div>
      </div>

      {!ready ? (
        <p className={NOTE}>{LETTERBOXD_NOT_READY}</p>
      ) : account ? (
        <>
          {account.lastError ? (
            <p className="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{account.lastError}</span>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Os filmes que você registra no diário chegam sozinhos — com a nota, a data e o pôster —,
            uma vez por dia e quando você abre a categoria. O feed traz só os ~50 mais recentes: o
            histórico inteiro vem pelo arquivo, em Importar. Nome, nota e imagem continuam seus.
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
                Ver os filmes
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
          A conexão com o Letterboxd ainda não foi ativada neste Vitrine (falta o CRON_SECRET no
          servidor).
        </p>
      ) : (
        <form onSubmit={connect} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Digite o seu @ (o do endereço do seu perfil): os filmes do diário entram numa categoria
            “Filmes” (na pasta “Letterboxd”) e chegam sozinhos dali em diante. Sem senha — o Vitrine
            lê só o que já é público no seu perfil.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@seu_usuario"
              aria-label="Seu @ do Letterboxd"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="sm:max-w-64"
            />
            <Button type="submit" size="sm" disabled={pending || !username.trim()}>
              <Clapperboard className="size-4" /> {pending ? "Conectando…" : "Conectar Letterboxd"}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Desconectar o Letterboxd"
        description={
          <p>
            Os filmes que já vieram continuam na sua categoria, só param de ser atualizados. Dá para
            conectar de novo quando quiser.
          </p>
        }
        confirmLabel="Desconectar"
        pendingLabel="Desconectando…"
        onConfirm={async () => {
          const result = await disconnectLetterboxdAction()
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          setConfirming(false)
          toast.success("Letterboxd desconectado.")
          router.refresh()
        }}
      />
    </div>
  )
}
