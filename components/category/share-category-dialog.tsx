"use client"

import { Copy, Lock, Share2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { categoryQrAction } from "@/app/categoria/[categoryId]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { Visibility } from "@/lib/domain/privacy"

/** Quem abre o link, conforme o nível que vale (o mais fechado do caminho). */
const WHO_OPENS: Record<Visibility, string> = {
  public: "Qualquer pessoa abre, mesmo sem conta no Vitrine.",
  friends: "Só os seus amigos abrem (entrando na conta deles).",
  private: "Está privada: só você abre. Para compartilhar, mude quem vê no selo ao lado do nome.",
}

/**
 * O "Compartilhar" do ⋯ da categoria: o QR do link (gerado no servidor, na
 * primeira vez que abre), copiar o link e o compartilhar do celular. Avisa
 * quem consegue abrir — o link não muda a privacidade de nada.
 */
export function ShareCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  name,
  visibility,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  name: string
  /** O nível que vale de fato (a pasta acima pode fechar mais). */
  visibility: Visibility
}) {
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null)

  // O QR é pedido ao abrir (uma vez): a biblioteca fica no servidor.
  useEffect(() => {
    if (!open || qr) return
    let alive = true
    void categoryQrAction({ id: categoryId }).then((result) => {
      if (!alive) return
      if (result.ok && result.data) setQr(result.data)
      else toast.error(result.ok ? "Não deu para gerar o QR agora." : result.error)
    })
    return () => {
      alive = false
    }
  }, [open, qr, categoryId])

  async function copyLink() {
    if (!qr) return
    try {
      await navigator.clipboard.writeText(qr.url)
      toast.success("Link da categoria copiado.")
    } catch {
      toast.error(`Não deu para copiar. O link é ${qr.url}`)
    }
  }

  async function shareNative() {
    if (!qr) return
    try {
      await navigator.share({ title: name, url: qr.url })
    } catch {
      // Cancelou ou o navegador recusou: nada a fazer.
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="display text-2xl [overflow-wrap:anywhere]">
            Compartilhar “{name}”
          </DialogTitle>
          <DialogDescription>Quem escaneia o QR abre a categoria.</DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-fit rounded-2xl bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG gerado no servidor, sem otimizador
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
              alt={`QR do link da categoria ${name}`}
              className="size-52"
            />
          ) : (
            <Skeleton className="size-52 bg-neutral-200" />
          )}
        </div>
        {qr ? (
          <p className="text-center text-xs break-all text-muted-foreground">{qr.url}</p>
        ) : null}

        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-faint" />
          <span>{WHO_OPENS[visibility]}</span>
        </p>

        <div className="grid gap-2">
          <Button variant="secondary" size="lg" onClick={copyLink} disabled={!qr}>
            <Copy className="size-4" /> Copiar link
          </Button>
          {canShare ? (
            <Button variant="secondary" size="lg" onClick={shareNative} disabled={!qr}>
              <Share2 className="size-4" /> Enviar para…
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
