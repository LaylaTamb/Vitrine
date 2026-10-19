"use client"

import { Check, Eye, EyeOff, X } from "lucide-react"
import { useState, type ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import type { PasswordCheck } from "@/lib/domain/auth"
import { cn } from "@/lib/utils"

/**
 * Campo de senha com o olho para mostrar ou esconder. `autoComplete` diz ao
 * gerenciador de senhas o que é: "current-password" (entrar) ou
 * "new-password" (criar e trocar).
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("h-11 pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

/** Os requisitos da senha nova, marcando na hora o que já foi cumprido. */
export function PasswordChecklist({ checks }: { checks: PasswordCheck[] }) {
  return (
    <ul aria-label="Requisitos da senha" className="grid gap-1 text-xs sm:grid-cols-2">
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            "flex items-center gap-1.5 transition-colors",
            check.ok ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {check.ok ? (
            <Check aria-hidden className="size-3.5 shrink-0 text-brand" />
          ) : (
            <X aria-hidden className="size-3.5 shrink-0 text-faint" />
          )}
          <span>
            {check.label}
            <span className="sr-only">{check.ok ? ": ok" : ": falta"}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
