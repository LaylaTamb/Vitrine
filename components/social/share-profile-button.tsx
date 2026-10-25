"use client"

import Link from "next/link"
import { Copy, QrCode, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ShareStoryButton } from "@/components/social/share-story-button"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { profilePath } from "@/lib/domain/username"

/**
 * "Compartilhar" do seu perfil: o link, o story e o QR num lugar só (antes:
 * Meu QR na faixa social e o story no rodapé do cartão).
 */
export function ShareProfileButton({
  username,
  storyReady,
}: {
  username: string
  /** O cartão já está no banco (migração 23): sem ele não há story. */
  storyReady: boolean
}) {
  const [open, setOpen] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}${profilePath(username)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link do perfil copiado.")
    } catch {
      toast.error(`Não deu para copiar. O link é ${url}`)
    }
  }

  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
        <Share2 className="size-4" /> Compartilhar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="display text-2xl">Compartilhar perfil</DialogTitle>
            <DialogDescription>O link, um story pronto ou o seu QR.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="secondary" size="lg" className="justify-start" onClick={copyLink}>
              <Copy className="size-4" /> Copiar link do perfil
            </Button>
            {storyReady ? <ShareStoryButton username={username} /> : null}
            <Link
              href="/qr"
              className={buttonVariants({ variant: "secondary", size: "lg", className: "justify-start" })}
            >
              <QrCode className="size-4" /> Meu QR (quem escaneia vira amigo)
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
