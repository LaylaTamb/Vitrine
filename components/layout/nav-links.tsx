"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Coleções" },
  { href: "/explorar", label: "Explorar" },
  { href: "/filtro", label: "Filtro" },
  { href: "/mapa", label: "Mapa" },
  { href: "/tags", label: "Tags" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/usuarios", label: "Pessoas" },
]

/** Os links do app na barra de cima (do tablet para cima; no celular, no menu da conta). */
export function NavLinks() {
  const pathname = usePathname()

  return (
    // Entre 768 e 1024 px são 7 links, o sininho e o @: mais justos ali.
    <nav className="hidden items-center gap-0.5 md:flex lg:gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/categoria")
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm transition-colors lg:px-2.5",
              active
                ? "bg-brand-wash text-foreground"
                : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
