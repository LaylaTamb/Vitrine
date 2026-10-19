import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { requireUser } from "@/lib/queries/session"

export const metadata: Metadata = {
  title: "Criar senha · Vitrine",
}

/**
 * `/redefinir-senha` — onde o link de recuperação (ou de convite) leva. A
 * sessão vem do próprio link (`/auth/callback`); sem ela, o middleware manda
 * para o login.
 */
export default async function NewPasswordPage() {
  const user = await requireUser()

  return (
    <AuthShell
      title="Criar senha"
      description={
        user.email ? (
          <>
            Para a conta <span className="text-foreground">{user.email}</span>. Depois, é com
            ela que você entra.
          </>
        ) : (
          "Depois, é com ela que você entra."
        )
      }
    >
      <NewPasswordForm mode="reset" />
    </AuthShell>
  )
}
