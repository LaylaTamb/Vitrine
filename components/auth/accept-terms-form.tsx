"use client"

import { useState, type FormEvent } from "react"

import { acceptTermsAction } from "@/app/auth/actions"
import { TermsCheckbox } from "@/components/auth/terms-checkbox"
import { Button } from "@/components/ui/button"

/** A caixa e o botão da tela /aceitar-termos. Deu certo: o servidor segue para `next`. */
export function AcceptTermsForm({ next }: { next: string }) {
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    if (!acceptTerms) {
      setError("Marque a caixa para continuar.")
      return
    }
    setPending(true)
    setError(null)
    // Redirecionou: o `await` volta vazio e o botão fica travado até a troca de tela.
    const result = await acceptTermsAction({ acceptTerms, next })
    if (result && !result.ok) {
      setPending(false)
      setError(result.error)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TermsCheckbox
        checked={acceptTerms}
        invalid={Boolean(error) && !acceptTerms}
        onChange={(checked) => {
          setAcceptTerms(checked)
          if (checked) setError(null)
        }}
      />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Salvando…" : "Aceitar e continuar"}
      </Button>
    </form>
  )
}
