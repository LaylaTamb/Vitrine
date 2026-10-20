"use client"

import { Camera, CameraOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { scannedProfilePath } from "@/lib/domain/qr"

// `BarcodeDetector` ainda não está nos tipos do TypeScript (nem em todo
// navegador: Chrome no Android e no Mac, sim; Safari e Firefox, não).
interface DetectedCode {
  rawValue: string
}
interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>
}
interface DetectorClass {
  new (options?: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

type ScanState = "starting" | "scanning" | "unsupported" | "denied" | "no-camera" | "failed"

const MESSAGES: Record<Exclude<ScanState, "starting" | "scanning">, string> = {
  unsupported:
    "Este navegador não lê QR por aqui. Abra a câmera do celular e aponte para o QR da pessoa: o link abre o Vitrine e vocês viram amigos.",
  denied:
    "Sem acesso à câmera. Libere a câmera para este site nas configurações do navegador — ou use a câmera do celular, que também funciona.",
  "no-camera":
    "Nenhuma câmera encontrada. No celular, a câmera comum também lê o QR: aponte e toque no link.",
  failed:
    "Não deu para abrir a câmera agora. Tente de novo, ou use a câmera do celular apontando para o QR.",
}

async function detectorClass(): Promise<DetectorClass | null> {
  const found = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (!found || !navigator.mediaDevices?.getUserMedia) return null
  try {
    const formats = (await found.getSupportedFormats?.()) ?? ["qr_code"]
    return formats.includes("qr_code") ? found : null
  } catch {
    return null
  }
}

function stateFromError(error: unknown): ScanState {
  const name = (error as { name?: unknown })?.name
  if (name === "NotAllowedError" || name === "SecurityError") return "denied"
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-camera"
  return "failed"
}

/**
 * "Ler QR": a câmera traseira com `BarcodeDetector`. Só abre perfis do
 * próprio Vitrine (`scannedProfilePath`); qualquer outro QR é recusado.
 */
export function QrScanner() {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ScanState>("starting")
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const origins = [window.location.origin, process.env.NEXT_PUBLIC_SITE_URL ?? ""]

    function stop() {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }

    async function start() {
      const Detector = await detectorClass()
      if (stopped) return
      if (!Detector) {
        setState("unsupported")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
      } catch (error) {
        if (!stopped) setState(stateFromError(error))
        return
      }
      const element = video.current
      if (stopped || !element) {
        stop()
        return
      }
      element.srcObject = stream
      await element.play().catch(() => undefined)
      setState("scanning")

      const detector = new Detector({ formats: ["qr_code"] })
      async function tick() {
        if (stopped || !element) return
        try {
          if (element.readyState >= 2) {
            for (const code of await detector.detect(element)) {
              const path = scannedProfilePath(code.rawValue, origins)
              if (path) {
                stop()
                router.push(path)
                return
              }
              setHint("Este QR não é de um perfil do Vitrine.")
            }
          }
        } catch {
          // Quadro ruim (câmera ainda focando): tenta no próximo.
        }
        timer = setTimeout(tick, 250)
      }
      void tick()
    }

    void start()
    return stop
  }, [router])

  const problem = state === "starting" || state === "scanning" ? null : MESSAGES[state]

  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-5 text-center">
      <div className="relative mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-xl bg-surface-hi">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Câmera"
          className={state === "scanning" ? "size-full object-cover" : "hidden"}
        />
        {state === "scanning" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/80"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
            {problem ? (
              <>
                <CameraOff aria-hidden className="size-6 text-faint" />
                <p>{problem}</p>
              </>
            ) : (
              <>
                <Camera aria-hidden className="size-6 animate-pulse text-faint" />
                <p>Abrindo a câmera…</p>
              </>
            )}
          </div>
        )}
      </div>

      <p role="status" className="mt-4 min-h-5 text-sm text-muted-foreground">
        {state === "scanning"
          ? (hint ?? "Aponte para o QR da pessoa. O perfil abre sozinho e vocês viram amigos.")
          : null}
      </p>
    </div>
  )
}
