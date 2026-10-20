"use client"

import { Download, Share, Smartphone, X } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * O Vitrine instalável (PWA): registra o service worker mínimo (`/sw.js`) e
 * guarda o pedido de instalação do navegador (`beforeinstallprompt`) para o
 * aviso discreto e o botão das Configurações usarem quando a pessoa quiser.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** No layout raiz, uma vez: o service worker e o pedido de instalação. */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem service worker o site funciona igual; só não instala.
      })
    }
    function onPrompt(event: Event) {
      // Guarda para a hora em que a pessoa tocar em "Instalar".
      event.preventDefault()
      deferred = event as InstallPromptEvent
      emit()
    }
    function onInstalled() {
      deferred = null
      emit()
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])
  return null
}

const noSubscribe = () => () => {}

/** Dá para instalar agora? Já está instalado? É iPhone (que não tem o pedido)? */
export function useInstall() {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false
  )
  const standalone = useSyncExternalStore(
    noSubscribe,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false
  )
  const ios = useSyncExternalStore(
    noSubscribe,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false
  )

  async function install(): Promise<boolean> {
    const event = deferred
    if (!event) return false
    await event.prompt()
    const choice = await event.userChoice
    deferred = null
    emit()
    return choice.outcome === "accepted"
  }

  return { canInstall, standalone, ios, install }
}

const DISMISS_KEY = "vitrine:instalar:aviso"

/**
 * O aviso discreto de "Instale o Vitrine", depois do login: só quando o
 * navegador oferece a instalação, e some para sempre no "Agora não".
 */
export function InstallBanner() {
  const { canInstall, standalone, install } = useInstall()
  const [dismissed, setDismissed] = useState(true)

  // localStorage só existe no navegador: começa escondido e confere depois.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "dispensado")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!canInstall || standalone || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, "dispensado")
    } catch {
      // Sem localStorage (modo privado): some só nesta visita.
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
      <Smartphone aria-hidden className="size-4 shrink-0 text-brand" />
      <p className="min-w-[12rem] flex-1 text-muted-foreground">
        Instale o Vitrine para salvar direto do botão Compartilhar de outros apps.
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={async () => {
            if (await install()) toast.success("Pronto: o Vitrine está instalado.")
          }}
        >
          <Download className="size-3.5" /> Instalar
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Agora não">
          <X className="size-3.5" /> Agora não
        </Button>
      </div>
    </div>
  )
}

/** Nas Configurações: o botão de instalar, ou o que fazer em cada aparelho. */
export function InstallSettings() {
  const { canInstall, standalone, ios, install } = useInstall()

  if (standalone) {
    return (
      <p className="text-sm text-muted-foreground">
        Você já está usando o Vitrine instalado. No Android, ele aparece no botão Compartilhar
        dos outros apps.
      </p>
    )
  }

  if (ios) {
    return (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-2">
          <Share aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            No iPhone: abra no Safari, toque em <span className="text-foreground">Compartilhar</span>{" "}
            e depois em <span className="text-foreground">Adicionar à Tela de Início</span>.
          </span>
        </p>
        <p className="text-xs text-faint">
          O iPhone não deixa um app da web aparecer no &ldquo;Compartilhar&rdquo; dos outros
          apps — isso chega com o app nativo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {canInstall ? (
        <Button
          variant="outline"
          onClick={async () => {
            if (await install()) toast.success("Pronto: o Vitrine está instalado.")
          }}
        >
          <Download className="size-4" /> Instalar o Vitrine
        </Button>
      ) : null}
      <p className="text-xs leading-relaxed text-faint">
        {canInstall
          ? "Instalado no celular, ele abre como um app e aparece no botão Compartilhar dos outros apps."
          : "No celular Android, abra no Chrome e use o menu ⋮ → Instalar app. Instalado, ele aparece no botão Compartilhar dos outros apps."}
      </p>
    </div>
  )
}
