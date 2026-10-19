"use client"

import { MailCheck } from "lucide-react"
import { useState, type FormEvent } from "react"

import { requestPasswordResetAction } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Pedir o link para criar uma senha nova. A resposta é a mesma exista ou não
 * a conta — a tela nunca revela quem está cadastrado.
 */
export function PasswordResetForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const result = await requestPasswordResetAction({ email })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSentTo(email.trim().toLowerCase())
  }

  if (sentTo) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-lg border border-brand-dim/40 bg-brand-wash px-3 py-3">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="space-y-1 text-sm">
            <p className="text-foreground">Pedido recebido.</p>
            <p className="leading-relaxed text-muted-foreground">
              Se existir uma conta com <span className="text-foreground">{sentTo}</span>, chega
              em instantes um link para criar a senha nova. Ele vale por pouco tempo e só
              uma vez.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSentTo(null)}
          className="h-10 w-full"
        >
          Usar outro e-mail
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="plaque">
          E-mail da conta
        </Label>
        <Input
          id="email"
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Enviando…" : "Mandar o link"}
      </Button>
    </form>
  )
}
