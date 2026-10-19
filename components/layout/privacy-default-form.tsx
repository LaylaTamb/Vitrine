"use client"

import { Globe, Lock } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { setDefaultPrivacyAction } from "@/app/configuracoes/actions"
import { cn } from "@/lib/utils"

const OPTIONS = [
  {
    value: true,
    label: "Públicas por padrão",
    hint: "Quem tem acesso ao app vê o que você cria.",
    Icon: Globe,
  },
  {
    value: false,
    label: "Privadas por padrão",
    hint: "Só você vê, até você mudar no topo de cada uma.",
    Icon: Lock,
  },
] as const

/**
 * Como nascem as próximas pastas e categorias: públicas ou privadas. Grava
 * na hora; as que já existem continuam como estão.
 */
export function PrivacyDefaultForm({ defaultPublic }: { defaultPublic: boolean }) {
  const [value, setValue] = useState(defaultPublic)
  const [pending, setPending] = useState(false)

  async function choose(next: boolean) {
    if (next === value || pending) return
    const previous = value
    setValue(next)
    setPending(true)
    const result = await setDefaultPrivacyAction({ isPublic: next })
    setPending(false)
    if (!result.ok) {
      setValue(previous)
      toast.error(result.error)
      return
    }
    toast.success(
      next
        ? "Pronto: o que você criar daqui em diante nasce público."
        : "Pronto: o que você criar daqui em diante nasce privado."
    )
  }

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Privacidade de novas pastas e categorias"
        aria-busy={pending}
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map(({ value: option, label, hint, Icon }) => (
          <button
            key={label}
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
        ))}
      </div>
      <p className="text-xs leading-relaxed text-faint">
        {pending
          ? "Salvando…"
          : "Vale para as próximas pastas e categorias. As que já existem não mudam — cada uma tem o seu botão Pública/Privada."}
      </p>
    </div>
  )
}
