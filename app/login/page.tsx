import type { Metadata } from "next"
import Link from "next/link"

import { AUTH_LINK_CLASS, AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { safeNextPath } from "@/lib/domain/auth"
import { translateErrorCode } from "@/lib/domain/errors"

export const metadata: Metadata = {
  title: "Entrar · Vitrine",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; proximo?: string; conta?: string }>
}) {
  const params = await searchParams
  const error = translateErrorCode(params.erro ?? null)
  // Depois de "Excluir minha conta" (Configurações).
  const notice =
    params.conta === "excluida"
      ? "Sua conta foi excluída, com tudo o que estava nela. Obrigado por ter usado o Vitrine."
      : null
  // Só destino interno: nada de redirecionar para fora do app.
  const next = safeNextPath(params.proximo)

  return (
    <AuthShell
      title="Entrar"
      footer={
        <p>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className={AUTH_LINK_CLASS}>
            Criar conta
          </Link>
        </p>
      }
    >
      <LoginForm initialError={error} initialNotice={notice} next={next} />
    </AuthShell>
  )
}
