import Link from "next/link"
import type { ReactNode } from "react"

import { Wordmark } from "@/components/layout/wordmark"
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/domain/terms"

const NAV_LINK = "text-muted-foreground transition-colors hover:text-foreground"

/**
 * A moldura dos dois textos legais: abre com ou sem login, sem consultar
 * nada (página estática). A versão e a data ficam no topo.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="shell flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
          >
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/termos" className={NAV_LINK}>
              Termos
            </Link>
            <Link href="/privacidade" className={NAV_LINK}>
              Privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main className="shell pb-24">
        <article className="mx-auto max-w-[44rem] space-y-8 py-10">
          <header className="space-y-3">
            <p className="plaque">
              Versão {TERMS_VERSION} · em vigor desde {TERMS_EFFECTIVE_DATE}
            </p>
            <h1 className="display text-3xl leading-tight sm:text-4xl">{title}</h1>
            <div className="text-base leading-relaxed text-muted-foreground">{intro}</div>
          </header>
          {children}
        </article>
      </main>
    </div>
  )
}

/** Uma seção numerada do texto. Listas, negrito e links já saem no estilo. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="display text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-brand [&_code]:text-foreground [&_strong]:font-normal [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
