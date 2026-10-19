"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { updatePasswordAction } from "@/app/auth/actions"
import { PasswordChecklist, PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { passwordChecks, passwordProblem } from "@/lib/domain/auth"

/**
 * Gravar a senha nova de quem está logado. Serve à tela que o link de
 * recuperação abre (e, de lá, segue para o app) e às Configurações (fica na
 * mesma tela, com os campos limpos).
 */
export function NewPasswordForm({ mode }: { mode: "reset" | "settings" }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const problem = passwordProblem(password, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setPending(true)
    setError(null)
    const result = await updatePasswordAction({ password, confirm })
    if (!result.ok) {
      setPending(false)
      setError(result.error)
      return
    }

    toast.success(
      mode === "reset"
        ? "Senha criada. Da próxima vez, entre com o e-mail e esta senha."
        : "Senha salva. As outras sessões da conta foram encerradas."
    )
    setPassword("")
    setConfirm("")
    if (mode === "reset") {
      router.replace("/")
      router.refresh()
      return
    }
    setPending(false)
  }

  const prefix = mode === "reset" ? "nova" : "conta"

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-senha`} className="plaque">
          Nova senha
        </Label>
        <PasswordInput
          id={`${prefix}-senha`}
          name="new-password"
          required
          autoFocus={mode === "reset"}
          autoComplete="new-password"
          aria-describedby={`${prefix}-regras`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-confirmar`} className="plaque">
          Confirme a nova senha
        </Label>
        <PasswordInput
          id={`${prefix}-confirmar`}
          name="confirm-password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>

      <div id={`${prefix}-regras`}>
        <PasswordChecklist checks={passwordChecks(password, confirm)} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className={mode === "reset" ? "h-11 w-full" : undefined}
      >
        {pending ? "Salvando…" : mode === "reset" ? "Salvar e entrar" : "Salvar senha"}
      </Button>
    </form>
  )
}
