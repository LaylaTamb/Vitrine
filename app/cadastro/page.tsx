import type { Metadata } from "next"
import Link from "next/link"

import { AUTH_LINK_CLASS, AuthShell } from "@/components/auth/auth-shell"
import { SignUpForm } from "@/components/auth/signup-form"
import { authHref, safeNextPath } from "@/lib/domain/auth"

export const metadata: Metadata = {
  title: "Criar conta · Vitrine",
}

/**
 * `/cadastro` — criar conta com e-mail e senha (confirmada por um link no
 * e-mail). `?proximo=`: a tela de onde o visitante veio, para onde ele volta.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const next = safeNextPath((await searchParams).proximo)
  return (
    <AuthShell
      title="Criar conta"
      description="Com e-mail e senha. Depois é só confirmar o e-mail pelo link que enviamos."
      footer={
        <p>
          Já tem conta?{" "}
          <Link href={authHref("/login", next)} className={AUTH_LINK_CLASS}>
            Entrar
          </Link>
        </p>
      }
    >
      <SignUpForm next={next} />
    </AuthShell>
  )
}
