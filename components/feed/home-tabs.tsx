import Link from "next/link"
import { Sparkles, Users, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type HomeTab = "amigos" | "sugestoes"

const TABS: { id: HomeTab; label: string; href: string; Icon: LucideIcon }[] = [
  { id: "amigos", label: "Amigos", href: "/inicio", Icon: Users },
  { id: "sugestoes", label: "Sugestões", href: "/inicio?aba=sugestoes", Icon: Sparkles },
]

/** `?aba=` → a aba do Início (sem ou estranho = Amigos). */
export function homeTabOf(raw: unknown): HomeTab {
  return raw === "sugestoes" ? "sugestoes" : "amigos"
}

/**
 * O seletor do Início: Amigos (o feed de quem você segue) ou Sugestões (o
 * antigo Descobrir). São links, como as abas do perfil: cada aba carrega só os
 * próprios dados, no servidor. Fica preso no topo ao rolar (embaixo do
 * cabeçalho, no celular). `news`: quantas pessoas que você segue têm novidade.
 */
export function HomeTabs({ current, news }: { current: HomeTab; news: number }) {
  return (
    <nav
      aria-label="O que ver no Início"
      className="sticky top-14 z-30 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md md:top-0 md:mx-0 md:px-0"
    >
      <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-1">
        {TABS.map(({ id, label, href, Icon }) => {
          const active = id === current
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-brand-wash text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
              {id === "amigos" && news > 0 ? (
                <span className="rounded-full bg-brand px-1.5 text-[0.7rem] leading-[1.1rem] font-medium text-primary-foreground">
                  <span className="sr-only">, </span>
                  {news > 9 ? "9+" : news}
                  <span className="sr-only"> com novidade</span>
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
