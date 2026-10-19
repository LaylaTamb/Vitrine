"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { resendConfirmationAction, signInAction } from "@/app/auth/actions"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Entrar com e-mail e senha. */
export function LoginForm({
  initialError,
  next,
}: {
  initialError: string | null
  next: string
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(initialError)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    setNotice(null)
    setUnconfirmed(false)

    // Deu certo: o servidor redireciona, e o botão fica travado até a troca de tela.
    const result = await signInAction({ email, password, next })
    if (result && !result.ok) {
      setPending(false)
      setError(result.error)
      setUnconfirmed(Boolean(result.unconfirmed))
    }
  }

  async function resend() {
    setPending(true)
    const result = await resendConfirmationAction({ email })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUnconfirmed(false)
    setError(null)
    setNotice("Se ainda faltava confirmar, um novo link está a caminho. Confira também o spam.")
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="plaque">
          E-mail
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

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="password" className="plaque">
            Senha
          </Label>
          <Link
            href="/recuperar-senha"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-brand">
          {notice}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>

      {unconfirmed ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={resend}
          className="h-10 w-full"
        >
          Reenviar o e-mail de confirmação
        </Button>
      ) : null}
    </form>
  )
}
