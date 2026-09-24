"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Coleções" },
  { href: "/filtro", label: "Filtro" },
  { href: "/tags", label: "Tags" },
  { href: "/usuarios", label: "Pessoas" },
]

export function NavLinks({ hideUsers = false }: { hideUsers?: boolean }) {
  const pathname = usePathname()
  const links = hideUsers ? LINKS.filter((link) => link.href !== "/usuarios") : LINKS

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/categoria")
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
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
