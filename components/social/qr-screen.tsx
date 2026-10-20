"use client"

import { QrCode, RefreshCw, ScanLine } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { issueQrAction, type QrCode as IssuedQr } from "@/app/v/actions"
import { QrScanner } from "@/components/social/qr-scanner"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { QR_REFRESH_MS } from "@/lib/domain/qr"
import { cn } from "@/lib/utils"

export type QrMode = "show" | "scan"

const MODES: { value: QrMode; label: string; Icon: typeof QrCode }[] = [
  { value: "show", label: "Meu QR", Icon: QrCode },
  { value: "scan", label: "Ler QR", Icon: ScanLine },
]

/**
 * `/qr`: mostrar o próprio QR ou ler o de alguém. Quem escaneia o QR vira
 * amigo do dono na hora (os dois passam a se seguir).
 */
export function QrScreen({
  name,
  username,
  avatarUrl,
  initialMode,
}: {
  name: string
  username: string
  avatarUrl: string | null
  initialMode: QrMode
}) {
  const [mode, setMode] = useState(initialMode)

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 pb-12">
      <div
        role="group"
        aria-label="Mostrar ou ler QR"
        className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
      >
        {MODES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              mode === value
                ? "bg-brand-wash text-brand"
                : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
            )}
          >
            <Icon aria-hidden className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "show" ? (
        <MyQr name={name} username={username} avatarUrl={avatarUrl} />
      ) : (
        <QrScanner />
      )}
    </div>
  )
}

/**
 * O QR com um código novo ao abrir e a cada ~4 minutos (ele vale 5). Ao
 * voltar para a aba depois de um tempo, troca na hora: com a tela apagada o
 * navegador atrasa os timers.
 */
function MyQr({
  name,
  username,
  avatarUrl,
}: {
  name: string
  username: string
  avatarUrl: string | null
}) {
  const [code, setCode] = useState<IssuedQr | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const issuedAt = useRef(0)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function refresh() {
      clearTimeout(timer)
      const result = await issueQrAction()
      if (!alive) return
      if (!result.ok || !result.data) {
        setError(result.ok ? "Não deu para gerar o QR agora." : result.error)
        return
      }
      issuedAt.current = Date.now()
      setError(null)
      setCode(result.data)
      timer = setTimeout(refresh, QR_REFRESH_MS)
    }

    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - issuedAt.current > 60_000) {
        void refresh()
      }
    }

    void refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [attempt])

  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-5 text-center">
      <div className="mb-4 flex items-center justify-center gap-2.5">
        <Avatar name={name} src={avatarUrl} size={36} />
        <div className="min-w-0 text-left">
          <p className="display truncate text-lg leading-tight">{name}</p>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>
        </div>
      </div>

      {/* Fundo branco de propósito (fora dos tokens do tema escuro): QR claro
          com módulos escuros é o que toda câmera lê de primeira. */}
      <div className="mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-xl bg-white">
        {error ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface-hi p-4 text-sm text-muted-foreground">
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw className="size-4" /> Tentar de novo
            </Button>
          </div>
        ) : code ? (
          // eslint-disable-next-line @next/next/no-img-element -- proposital: SVG gerado no servidor, sem otimizador
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code.svg)}`}
            alt={`QR para virar amigo de @${username}`}
            className="size-full"
          />
        ) : (
          <div aria-label="Gerando o QR" className="size-full animate-pulse bg-surface-hi" />
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Quem escanear com a câmera do celular vira seu amigo na hora — vocês dois passam a se
        seguir.
      </p>
      <p className="mt-1.5 text-xs text-faint">
        O código troca sozinho a cada 4 minutos, então um print não serve por muito tempo.
      </p>
    </div>
  )
}
