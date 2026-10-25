import Link from "next/link"

import { cn } from "@/lib/utils"

export type ProfileTab = "colecoes" | "favoritas" | "mapa"

const TABS: { id: ProfileTab; label: string; query: string }[] = [
  { id: "colecoes", label: "Coleções", query: "" },
  { id: "favoritas", label: "Favoritas", query: "?aba=favoritas" },
  { id: "mapa", label: "Mapa", query: "?aba=mapa" },
]

/** `?aba=` → a aba do seu perfil (sem ou estranho = Coleções). */
export function profileTabOf(raw: unknown): ProfileTab {
  return raw === "favoritas" || raw === "mapa" ? raw : "colecoes"
}

/**
 * As abas do SEU perfil: Coleções, Favoritas e Mapa (antes, três telas
 * soltas). São links: cada aba carrega só os próprios dados, no servidor.
 */
export function ProfileTabs({ path, current }: { path: string; current: ProfileTab }) {
  return (
    <nav aria-label="Seções do perfil" className="mt-8 mb-5 flex gap-1 border-b border-line">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`${path}${tab.query}`}
          scroll={false}
          aria-current={tab.id === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
            tab.id === current
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
