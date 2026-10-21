"use client"

import { Copy, Share2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

function isAbort(error: unknown): boolean {
  return (error as { name?: unknown })?.name === "AbortError"
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Computador = mouse de verdade. No Windows o Chrome também "compartilha"
 * arquivo (abre o compartilhar do sistema), mas ali o que se quer é colar a
 * imagem em algum lugar — então o computador copia, e o celular compartilha.
 */
function isDesktop(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

async function fetchStory(username: string): Promise<Blob> {
  const response = await fetch(`/v/${username}/story`, { cache: "no-store" })
  if (!response.ok) throw new Error(String(response.status))
  return response.blob()
}

/**
 * "Compartilhar no story": gera a imagem 9:16 do cartão (`/v/<@>/story`).
 * No celular, abre o compartilhar com o arquivo — dali, Instagram → Story. No
 * computador, copia a imagem para a área de transferência (e baixa, se o
 * navegador não deixar copiar).
 *
 * O Safari só deixa compartilhar logo depois do toque; se gerar a imagem
 * demorar demais, o botão vira "Compartilhar agora" (o segundo toque já tem a
 * imagem pronta). Pelo mesmo motivo, a cópia entrega a imagem como promessa,
 * criada ainda dentro do clique.
 */
export function ShareStoryButton({ username }: { username: string }) {
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState<File | null>(null)
  // Só depois de montar: o servidor não sabe se é computador.
  const [desktop, setDesktop] = useState(false)
  const fileName = `vitrine-${username}.png`

  useEffect(() => {
    setDesktop(isDesktop())
  }, [])

  async function share(file: File) {
    if (!navigator.canShare?.({ files: [file] })) {
      download(file, fileName)
      setReady(null)
      toast.success("Imagem baixada. Passe para o celular e poste no story.")
      return
    }
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
  }

  async function copy() {
    const blob = fetchStory(username)
    setPending(true)
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("sem área de transferência")
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      toast.success("Imagem copiada. Cole onde quiser (Ctrl+V).", {
        action: { label: "Baixar", onClick: () => void blob.then((b) => download(b, fileName)) },
      })
    } catch {
      // Não deu para copiar (navegador antigo, permissão): baixa.
      try {
        download(await blob, fileName)
        toast.success("Não deu para copiar, então a imagem foi baixada.")
      } catch {
        toast.error("Não deu para gerar a imagem agora. Tente de novo.")
      }
    } finally {
      setPending(false)
    }
  }

  async function run() {
    if (desktop) {
      await copy()
      return
    }
    if (ready) {
      await share(ready).catch(() => toast.error("Não deu para compartilhar. Tente de novo."))
      return
    }
    setPending(true)
    try {
      const blob = await fetchStory(username)
      await share(new File([blob], fileName, { type: "image/png" }))
    } catch {
      toast.error("Não deu para gerar a imagem agora. Tente de novo.")
    } finally {
      setPending(false)
    }
  }

  const Icon = desktop ? Copy : Share2
  return (
    <Button size="sm" onClick={run} disabled={pending}>
      <Icon className="size-4" />
      {pending
        ? "Gerando a imagem…"
        : desktop
          ? "Copiar imagem do story"
          : ready
            ? "Compartilhar agora"
            : "Compartilhar no story"}
    </Button>
  )
}
