import Link from "next/link"
import type { ReactNode } from "react"

import { Wordmark } from "@/components/layout/wordmark"

/**
 * A moldura das telas de conta (entrar, criar conta, recuperar e criar
 * senha, aceitar os termos): a marca, o título, o cartão, uma linha embaixo e
 * os links dos Termos e da Política de privacidade.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark size="lg" />
          <p className="plaque">Seu acervo particular</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-5 space-y-1.5">
            <h1 className="display text-2xl">{title}</h1>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {children}
        </div>

        {footer ? (
          <div className="mt-5 space-y-2 text-center text-sm text-muted-foreground">{footer}</div>
        ) : null}

        <p className="mt-6 text-center text-xs text-faint">
          <Link href="/termos" className="transition-colors hover:text-foreground">
            Termos de uso
          </Link>
          {" · "}
          <Link href="/privacidade" className="transition-colors hover:text-foreground">
            Política de privacidade
          </Link>
        </p>
      </div>
    </main>
  )
}

/** Link discreto das telas de conta ("Criar conta", "Voltar para entrar"…). */
export const AUTH_LINK_CLASS =
  "text-foreground underline underline-offset-2 transition-colors hover:text-brand"
