"use client"

import { useState } from "react"
import { toast } from "sonner"

import { setDefaultVisibilityAction } from "@/app/configuracoes/actions"
import { VISIBILITY_ICONS } from "@/components/collection/privacy-switch"
import { visibilityOptions, type Visibility } from "@/lib/domain/privacy"
import { cn } from "@/lib/utils"

const OPTIONS: Record<Visibility, { label: string; hint: string; saved: string }> = {
  public: {
    label: "Públicas por padrão",
    hint: "Qualquer pessoa vê o que você cria, mesmo sem conta.",
    saved: "Pronto: o que você criar daqui em diante nasce público.",
  },
  friends: {
    label: "Só amigos por padrão",
    hint: "Só quem você segue e segue você de volta.",
    saved: "Pronto: o que você criar daqui em diante nasce visível só para amigos.",
  },
  private: {
    label: "Privadas por padrão",
    hint: "Só você vê, até você mudar no topo de cada uma.",
    saved: "Pronto: o que você criar daqui em diante nasce privado.",
  },
}

/**
 * Como nascem as próximas pastas e categorias: Públicas, de Amigos ou
 * Privadas. Grava na hora; as que já existem continuam como estão.
 */
export function PrivacyDefaultForm({ defaultVisibility }: { defaultVisibility: Visibility }) {
  const [value, setValue] = useState(defaultVisibility)
  const [pending, setPending] = useState(false)
  const options = visibilityOptions(value)

  async function choose(next: Visibility) {
    if (next === value || pending) return
    const previous = value
    setValue(next)
    setPending(true)
    const result = await setDefaultVisibilityAction({ visibility: next })
    setPending(false)
    if (!result.ok) {
      setValue(previous)
      toast.error(result.error)
      return
    }
    toast.success(OPTIONS[next].saved)
  }

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Privacidade de novas pastas e categorias"
        aria-busy={pending}
        className={cn("grid gap-2", options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
      >
        {options.map((option) => {
          const Icon = VISIBILITY_ICONS[option]
          const { label, hint } = OPTIONS[option]
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              disabled={pending}
              onClick={() => choose(option)}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-wait",
                value === option
                  ? "border-brand-dim bg-brand-wash"
                  : "border-line bg-surface hover:border-line-hi"
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  value === option ? "text-brand" : "text-muted-foreground"
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm text-foreground">{label}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs leading-relaxed text-faint">
        {pending
          ? "Salvando…"
          : "Vale para as próximas pastas e categorias. As que já existem não mudam — cada uma tem o seu seletor de visibilidade, no topo."}
      </p>
    </div>
  )
}
