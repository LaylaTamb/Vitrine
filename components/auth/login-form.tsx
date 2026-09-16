"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { translateError } from "@/lib/domain/errors"
import { createClient } from "@/lib/supabase/client"

type Step = "email" | "code"

export function LoginForm({
  initialError,
  next,
}: {
  initialError: string | null
  next: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return

    setPending(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // O app é fechado por convite: ninguém se cadastra sozinho.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(next)}`,
      },
    })

    setPending(false)
    if (sendError) {
      setError(translateError(sendError))
      return
    }
    setStep("code")
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    const token = code.replace(/\D/g, "")
    if (token.length < 6) {
      setError("O código tem 6 dígitos.")
      return
    }

    setPending(true)
    setError(null)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    })

    if (verifyError) {
      setPending(false)
      setError(translateError(verifyError))
      return
    }

    router.replace(next)
    router.refresh()
  }

  async function resend() {
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(next)}`,
      },
    })
    setPending(false)
    if (sendError) {
      setError(translateError(sendError))
      return
    }
    setNotice("Enviei outro e-mail.")
  }

  if (step === "email") {
    return (
      <form onSubmit={sendLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="plaque">
            Seu e-mail
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

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "Enviando…" : "Entrar"}
        </Button>

        <p className="text-xs leading-relaxed text-muted-foreground">
          A Vitrine é fechada por convite. Você recebe um link e um código de 6
          dígitos — pode usar qualquer um dos dois.
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <div className="rounded-lg border border-line bg-bg-soft px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          Link enviado para <span className="text-foreground">{email.trim()}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code" className="plaque">
          Código de 6 dígitos
        </Label>
        <Input
          id="code"
          name="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-14 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? <p className="text-sm text-brand">{notice}</p> : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStep("email")
            setCode("")
            setError(null)
            setNotice(null)
          }}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Usar outro e-mail
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
        >
          Reenviar
        </button>
      </div>
    </form>
  )
}
