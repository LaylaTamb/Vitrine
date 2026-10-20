"use client"

import { Globe, Lock, Users, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import {
  VISIBILITY_LABELS,
  visibilityLabel,
  visibilityOptions,
  type Visibility,
} from "@/lib/domain/privacy"
import { cn } from "@/lib/utils"

/** O ícone de cada nível — o mesmo no seletor, nos cards e nas Configurações. */
export const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = {
  public: Globe,
  friends: Users,
  private: Lock,
}

/**
 * O seletor Pública / Amigos / Privada, só a aparência. "Amigos" fica
 * escondida até a Fase 3 (`visibilityOptions`). Quem usa decide o que
 * acontece ao trocar.
 */
export function VisibilityPicker({
  kind,
  value,
  onChange,
  disabled,
  className,
}: {
  kind: "folder" | "category"
  value: Visibility
  onChange: (value: Visibility) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={kind === "folder" ? "Visibilidade da pasta" : "Visibilidade da categoria"}
      aria-busy={disabled}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        className
      )}
    >
      {visibilityOptions(value).map((option) => {
        const Icon = VISIBILITY_ICONS[option]
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            title={visibilityLabel(kind, option)}
            disabled={disabled}
            onClick={() => {
              if (!selected) onChange(option)
            }}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors disabled:cursor-wait",
              selected
                ? "bg-brand-wash text-foreground"
                : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
            )}
          >
            <Icon aria-hidden className={cn("size-4", selected && "text-brand")} />
            <span>{VISIBILITY_LABELS[option]}</span>
          </button>
        )
      })}
    </div>
  )
}

function changedMessage(kind: "folder" | "category", name: string, visibility: Visibility): string {
  switch (visibility) {
    case "public":
      return `“${name}” agora é pública: qualquer pessoa vê, mesmo sem conta.`
    case "friends":
      return `“${name}” agora é só para amigos.`
    case "private":
      return `“${name}” agora é privada: só você vê${kind === "folder" ? " a pasta e tudo dentro dela" : ""}.`
  }
}

/**
 * O seletor que já grava: troca na hora (otimista), volta atrás com um aviso
 * se o servidor recusar. Vale para uma pasta das Coleções ou uma categoria —
 * só o dono vê.
 */
export function PrivacySwitch({
  kind,
  id,
  name,
  visibility,
  className,
}: {
  kind: "folder" | "category"
  id: string
  name: string
  visibility: Visibility
  className?: string
}) {
  const { actions } = useVitrine()
  const [optimistic, setOptimistic] = useState<Visibility | null>(null)
  const [pending, setPending] = useState(false)
  const shown = optimistic ?? visibility

  // O dado do servidor chegou: ele manda de novo.
  useEffect(() => {
    setOptimistic(null)
  }, [visibility])

  async function change(next: Visibility) {
    setOptimistic(next)
    setPending(true)
    const result =
      kind === "folder"
        ? await actions.setFolderVisibility({ id, visibility: next })
        : await actions.setCategoryVisibility({ id, visibility: next })
    setPending(false)
    if (!result.ok) {
      setOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(changedMessage(kind, name, next))
  }

  return (
    <VisibilityPicker
      kind={kind}
      value={shown}
      onChange={change}
      disabled={pending}
      className={className}
    />
  )
}

/** O aviso de quando o seletor diz uma coisa, mas uma pasta acima fecha mais. */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-faint" />
      <span>{children}</span>
    </p>
  )
}
