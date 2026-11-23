"use client"

import { Copy, Download, Lock, QrCode, Share2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { categoryQrAction } from "@/app/categoria/[categoryId]/actions"
import { download, isAbort, isDesktop } from "@/components/social/share-story-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { storyFileName } from "@/lib/domain/list-story"
import type { Visibility } from "@/lib/domain/privacy"

/** Quem abre o link, conforme o nível que vale (o mais fechado do caminho). */
const WHO_OPENS: Record<Visibility, string> = {
  public: "Qualquer pessoa abre, mesmo sem conta no Vitrine.",
  friends: "Só os seus amigos abrem (entrando na conta deles).",
  private: "Está privada: só você abre. Para compartilhar, mude quem vê no selo ao lado do nome.",
}

/** O mesmo, para quem compartilha a lista de outra pessoa. */
const WHO_OPENS_OTHERS: Record<Visibility, string> = {
  public: "Qualquer pessoa abre, mesmo sem conta no Vitrine.",
  friends: "Só os amigos de quem fez a lista abrem o link.",
  private: "Lista privada: o link só abre para quem fez.",
}

/**
 * O Compartilhar da categoria: a **imagem da lista** como está na tela (9:16,
 * gerada no servidor em `storySrc`), para mandar ou postar no story, e o
 * **link** com o QR. A imagem é buscada uma vez, ao abrir: compartilhar,
 * copiar e baixar usam a mesma (e o compartilhar do celular sai na hora do
 * toque, como o Safari exige). No computador, o principal é copiar.
 */
export function ShareCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  name,
  visibility,
  storySrc,
  storyLabel,
  signedIn = true,
  mine = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  name: string
  /** O nível que vale de fato (a pasta acima pode fechar mais). */
  visibility: Visibility
  /** A imagem do que está na tela (`storyHref`). */
  storySrc: string
  /** "Grade M · 8 de 24 itens": o que vai na imagem. */
  storyLabel: string
  /** Sem conta (lista pública): o link sem o QR (ele é gerado numa action com login). */
  signedIn?: boolean
  /** A lista é de quem compartilha (muda o aviso de quem abre o link). */
  mine?: boolean
}) {
  const [image, setImage] = useState<{ src: string; file: File } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [url, setUrl] = useState("")
  // Só depois de montar: o servidor não sabe se é computador nem se dá para compartilhar.
  const [desktop, setDesktop] = useState(false)
  const [canShareLink, setCanShareLink] = useState(false)
  const fileName = storyFileName(name)

  useEffect(() => {
    setDesktop(isDesktop())
    setCanShareLink(typeof navigator.share === "function")
    setUrl(`${window.location.origin}/categoria/${categoryId}`)
  }, [categoryId])

  // A imagem: gerada ao abrir (e de novo no "Tentar de novo").
  useEffect(() => {
    if (!open) return
    let alive = true
    let objectUrl: string | null = null
    setImage(null)
    setFailed(false)
    fetch(storySrc, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob()
      })
      .then((blob) => {
        if (!alive) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ src: objectUrl, file: new File([blob], fileName, { type: "image/png" }) })
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, storySrc, fileName, attempt])

  // O QR do link: pedido na primeira vez que alguém toca em "QR".
  useEffect(() => {
    if (!showQr || qr || !signedIn) return
    let alive = true
    void categoryQrAction({ id: categoryId }).then((result) => {
      if (!alive) return
      if (result.ok && result.data) setQr(result.data)
      else toast.error(result.ok ? "Não deu para gerar o QR agora." : result.error)
    })
    return () => {
      alive = false
    }
  }, [showQr, qr, signedIn, categoryId])

  const link = qr?.url ?? url

  async function shareImage() {
    if (!image) return
    if (!navigator.canShare?.({ files: [image.file] })) {
      download(image.file, fileName)
      toast.success("Imagem baixada. Agora é só mandar ou postar.")
      return
    }
    try {
      await navigator.share({ files: [image.file], title: name })
    } catch (error) {
      if (!isAbort(error)) toast.error("Não deu para compartilhar. Tente “Baixar PNG”.")
    }
  }

  async function copyImage() {
    if (!image) return
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("sem área de transferência")
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image.file })])
      toast.success("Imagem copiada. Cole onde quiser (Ctrl+V).")
    } catch {
      download(image.file, fileName)
      toast.success("Não deu para copiar, então a imagem foi baixada.")
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link da lista copiado.")
    } catch {
      toast.error(`Não deu para copiar. O link é ${link}`)
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: name, url: link })
    } catch {
      // Cancelou ou o navegador recusou: nada a fazer.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-2xl [overflow-wrap:anywhere]">
            Compartilhar “{name}”
          </DialogTitle>
          <DialogDescription>A imagem mostra o que está na tela: {storyLabel}.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- PNG gerado no servidor, sem otimizador
              <img
                src={image.src}
                alt={`A imagem da lista ${name}`}
                className="size-full object-cover"
              />
            ) : failed ? (
              <p className="p-2 text-xs text-muted-foreground">Não deu para gerar a imagem.</p>
            ) : (
              <Skeleton className="size-full rounded-none" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {failed ? (
              <Button size="lg" onClick={() => setAttempt((count) => count + 1)}>
                Tentar de novo
              </Button>
            ) : (
              <Button size="lg" onClick={desktop ? copyImage : shareImage} disabled={!image}>
                {desktop ? <Copy className="size-4" /> : <Share2 className="size-4" />}
                {image ? (desktop ? "Copiar imagem" : "Compartilhar imagem") : "Gerando…"}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={() => image && download(image.file, fileName)}
              disabled={!image}
            >
              <Download className="size-4" /> Baixar PNG
            </Button>
            <p className="text-xs leading-relaxed text-faint">
              Para mudar o que entra, feche, troque a exibição, o tamanho ou o filtro e abra de
              novo.
            </p>
          </div>
        </div>

        <section className="space-y-2.5 border-t border-line pt-4">
          <p className="plaque">Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label="Link da lista"
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg-soft px-3 text-xs text-muted-foreground outline-none"
            />
            <Button
              variant="outline"
              size="icon-lg"
              onClick={copyLink}
              aria-label="Copiar link"
              title="Copiar link"
            >
              <Copy className="size-4" />
            </Button>
            {signedIn ? (
              <Button
                variant={showQr ? "secondary" : "outline"}
                size="lg"
                onClick={() => setShowQr((on) => !on)}
                aria-pressed={showQr}
              >
                <QrCode className="size-4" /> QR
              </Button>
            ) : null}
          </div>
          {showQr ? (
            <div className="mx-auto w-fit rounded-2xl bg-white p-2">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- SVG gerado no servidor, sem otimizador
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
                  alt={`QR do link da lista ${name}`}
                  className="size-44"
                />
              ) : (
                <Skeleton className="size-44 bg-neutral-200" />
              )}
            </div>
          ) : null}
          {canShareLink ? (
            <Button variant="secondary" size="lg" className="w-full" onClick={shareLink}>
              <Share2 className="size-4" /> Enviar o link para…
            </Button>
          ) : null}
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-faint" />
            <span>{(mine ? WHO_OPENS : WHO_OPENS_OTHERS)[visibility]}</span>
          </p>
        </section>
      </DialogContent>
    </Dialog>
  )
}
