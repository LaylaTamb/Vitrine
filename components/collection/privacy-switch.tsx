"use client"

import { Globe, Lock } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import { buttonVariants } from "@/components/ui/button"
import { visibilityLabel } from "@/lib/domain/privacy"
import { cn } from "@/lib/utils"

/**
 * O interruptor Pública/Privada, só a aparência: o trilho, o ícone e a
 * palavra. Quem usa decide o que acontece ao trocar.
 */
export function PrivacyToggle({
  kind,
  checked,
  onChange,
  disabled,
  className,
}: {
  kind: "folder" | "category"
  /** `true` = pública. */
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const label = visibilityLabel(kind, checked)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2", className)}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line-hi"
        )}
      >
        <span
          className={cn(
            "block size-3 rounded-full bg-foreground shadow-sm transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
      {checked ? (
        <Globe aria-hidden className="size-4 text-muted-foreground" />
      ) : (
        <Lock aria-hidden className="size-4 text-muted-foreground" />
      )}
      <span>{checked ? "Pública" : "Privada"}</span>
    </button>
  )
}

/**
 * O interruptor que já grava: troca na hora (otimista), volta atrás com um
 * aviso se o servidor recusar. Vale para uma pasta das Coleções ou uma
 * categoria — só o dono vê.
 */
export function PrivacySwitch({
  kind,
  id,
  name,
  isPublic,
  className,
}: {
  kind: "folder" | "category"
  id: string
  name: string
  isPublic: boolean
  className?: string
}) {
  const { actions } = useVitrine()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const shown = optimistic ?? isPublic

  // O dado do servidor chegou: ele manda de novo.
  useEffect(() => {
    setOptimistic(null)
  }, [isPublic])

  async function change(next: boolean) {
    setOptimistic(next)
    setPending(true)
    const result =
      kind === "folder"
        ? await actions.setFolderVisibility({ id, isPublic: next })
        : await actions.setCategoryVisibility({ id, isPublic: next })
    setPending(false)
    if (!result.ok) {
      setOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(
      next
        ? `“${name}” está visível para quem tem acesso ao app.`
        : `“${name}” agora é privada: só você vê${kind === "folder" ? " a pasta e tudo dentro dela" : ""}.`
    )
  }

  return (
    <PrivacyToggle
      kind={kind}
      checked={shown}
      onChange={change}
      disabled={pending}
      className={className}
    />
  )
}

/** O aviso de quando o interruptor diz "Pública", mas uma pasta acima esconde tudo. */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-faint" />
      <span>{children}</span>
    </p>
  )
}
