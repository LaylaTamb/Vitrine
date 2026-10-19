import type { Metadata } from "next"
import Link from "next/link"

import { AUTH_LINK_CLASS, AuthShell } from "@/components/auth/auth-shell"
import { PasswordResetForm } from "@/components/auth/password-reset-form"

export const metadata: Metadata = {
  title: "Recuperar senha · Vitrine",
}

/** `/recuperar-senha` — pede o link para criar uma senha nova. */
export default function PasswordResetPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      description="Mandamos um link para você criar uma senha nova. Também vale para quem entrava pelo link do e-mail e ainda não tem senha."
      footer={
        <p>
          Lembrou?{" "}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Voltar para entrar
          </Link>
        </p>
      }
    >
      <PasswordResetForm />
    </AuthShell>
  )
}
