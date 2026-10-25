import Link from "next/link"

import type { VisitorInfo } from "@/components/layout/app-shell"
import { Wordmark } from "@/components/layout/wordmark"
import { buttonVariants } from "@/components/ui/button"

/**
 * A barra de cima de quem não está no app logado: a página pública aberta
 * sem conta (`visitor`: Entrar, que volta para esta página, e Criar conta) ou
 * a conta sem perfil (só a marca). Com login, a navegação é a `AppNav`.
 */
export function Navbar({ visitor }: { visitor?: VisitorInfo }) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-line"
      style={{
        background: "rgba(19, 19, 21, 0.86)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="shell flex h-14 items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
        >
          <Wordmark />
        </Link>

        {visitor ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/login?proximo=${encodeURIComponent(visitor.next)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Entrar
            </Link>
            <Link href="/cadastro" className={buttonVariants({ size: "sm" })}>
              Criar conta
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}
