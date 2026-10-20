"use client"

import Link from "next/link"

import { AUTH_LINK_CLASS } from "@/components/auth/auth-shell"
import { Checkbox } from "@/components/ui/checkbox"
import { MINIMUM_AGE } from "@/lib/domain/terms"

/**
 * A caixa obrigatória do cadastro e da tela de aceite. Os links abrem numa
 * aba nova: ler os textos não apaga o que já foi digitado.
 */
export function TermsCheckbox({
  checked,
  onChange,
  invalid = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  invalid?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id="accept-terms"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-invalid={invalid}
        className="mt-0.5"
      />
      <label htmlFor="accept-terms" className="text-sm leading-relaxed text-muted-foreground">
        Tenho {MINIMUM_AGE} anos ou mais e aceito os{" "}
        <Link href="/termos" target="_blank" className={AUTH_LINK_CLASS}>
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" target="_blank" className={AUTH_LINK_CLASS}>
          Política de privacidade
        </Link>
        .
      </label>
    </div>
  )
}
