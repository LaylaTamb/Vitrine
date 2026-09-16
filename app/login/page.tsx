import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"
import { Wordmark } from "@/components/layout/wordmark"
import { translateErrorCode } from "@/lib/domain/errors"

export const metadata: Metadata = {
  title: "Entrar · Vitrine",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; proximo?: string }>
}) {
  const params = await searchParams
  const error = translateErrorCode(params.erro ?? null)
  // Só destino interno: nada de redirecionar para fora do app.
  const next = params.proximo?.startsWith("/") ? params.proximo : "/"

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark size="lg" />
          <p className="plaque">Seu acervo particular</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <LoginForm initialError={error} next={next} />
        </div>
      </div>
    </main>
  )
}
