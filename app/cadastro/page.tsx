import type { Metadata } from "next"
import Link from "next/link"

import { AUTH_LINK_CLASS, AuthShell } from "@/components/auth/auth-shell"
import { SignUpForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Criar conta · Vitrine",
}

/** `/cadastro` — criar conta com e-mail e senha (confirmada por um link no e-mail). */
export default function SignUpPage() {
  return (
    <AuthShell
      title="Criar conta"
      description="Com e-mail e senha. Depois é só confirmar o e-mail pelo link que enviamos."
      footer={
        <p>
          Já tem conta?{" "}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Entrar
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  )
}
