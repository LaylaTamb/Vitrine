"use client"

import Link from "next/link"
import { MailCheck } from "lucide-react"
import { useState, type FormEvent } from "react"

import { resendConfirmationAction, signUpAction } from "@/app/auth/actions"
import { AUTH_LINK_CLASS } from "@/components/auth/auth-shell"
import { PasswordChecklist, PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { passwordChecks, passwordProblem } from "@/lib/domain/auth"

/** Criar conta: e-mail, senha e a confirmação da senha. */
export function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    // A mesma regra do servidor, antes de gastar uma ida até ele.
    const problem = passwordProblem(password, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setPending(true)
    setError(null)
    const result = await signUpAction({ email, password, confirm })
    // Com a confirmação de e-mail desligada no Supabase, o servidor já leva para dentro.
    if (!result) return
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSentTo(email.trim().toLowerCase())
    setPassword("")
    setConfirm("")
  }

  async function resend() {
    if (!sentTo) return
    setPending(true)
    const result = await resendConfirmationAction({ email: sentTo })
    setPending(false)
    setNotice(result.ok ? "Mandamos de novo. Confira também o spam." : result.error)
  }

  if (sentTo) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-lg border border-brand-dim/40 bg-brand-wash px-3 py-3">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="space-y-1 text-sm">
            <p className="text-foreground">Falta só confirmar o e-mail.</p>
            <p className="leading-relaxed text-muted-foreground">
              Mandamos um link para <span className="text-foreground">{sentTo}</span>. Abra o
              e-mail e toque no link para ativar a conta.
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Esse e-mail já tinha conta? Então nada foi enviado:{" "}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            entre
          </Link>{" "}
          ou use{" "}
          <Link href="/recuperar-senha" className={AUTH_LINK_CLASS}>
            Esqueci minha senha
          </Link>
          .
        </p>
        {notice ? <p className="text-sm text-brand">{notice}</p> : null}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={resend}
          className="h-10 w-full"
        >
          {pending ? "Enviando…" : "Não chegou? Mandar de novo"}
        </Button>
      </div>
    )
  }

  const checks = passwordChecks(password, confirm)

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
        <Label htmlFor="password" className="plaque">
          Senha
        </Label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          aria-describedby="password-rules"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm" className="plaque">
          Confirme a senha
        </Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>

      <div id="password-rules">
        <PasswordChecklist checks={checks} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  )
}
