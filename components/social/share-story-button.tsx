"use client"

import { Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

function isAbort(error: unknown): boolean {
  return (error as { name?: unknown })?.name === "AbortError"
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * "Compartilhar no story": gera a imagem 9:16 do cartão (`/v/<@>/story`) e
 * abre o compartilhar do celular com o arquivo — dali, Instagram → Story. Sem
 * compartilhar com arquivo (computador), baixa a imagem.
 *
 * O Safari só deixa compartilhar logo depois do toque; se gerar a imagem
 * demorar demais, o botão vira "Compartilhar agora" (o segundo toque já tem a
 * imagem pronta).
 */
export function ShareStoryButton({ username }: { username: string }) {
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState<File | null>(null)

  async function shareOrDownload(file: File) {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `@${username} no Vitrine` })
        setReady(null)
      } catch (error) {
        if (isAbort(error)) return
        if ((error as { name?: unknown })?.name === "NotAllowedError") {
          setReady(file)
          return
        }
        throw error
      }
      return
    }
    download(file)
    setReady(null)
    toast.success("Imagem baixada. Passe para o celular e poste no story.")
  }

  async function run() {
    if (ready) {
      await shareOrDownload(ready).catch(() =>
        toast.error("Não deu para compartilhar. Tente de novo.")
      )
      return
    }
    setPending(true)
    try {
      const response = await fetch(`/v/${username}/story`, { cache: "no-store" })
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      await shareOrDownload(new File([blob], `vitrine-${username}.png`, { type: "image/png" }))
    } catch {
      toast.error("Não deu para gerar a imagem agora. Tente de novo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button size="sm" onClick={run} disabled={pending}>
      <Share2 className="size-4" />
      {pending ? "Gerando a imagem…" : ready ? "Compartilhar agora" : "Compartilhar no story"}
    </Button>
  )
}
