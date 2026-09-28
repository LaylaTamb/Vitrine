import Link from "next/link"

import { NavLinks } from "@/components/layout/nav-links"
import { UserMenu } from "@/components/layout/user-menu"
import { Wordmark } from "@/components/layout/wordmark"
import { DEMO_BASE_PATH } from "@/lib/demo/config"
import { displayNameOf } from "@/lib/queries/session"
import type { Profile } from "@/lib/domain/types"

/**
 * `isDemo`: a demonstração em `/demo` — links com o prefixo, sem "Pessoas" e,
 * no lugar do menu da conta, um convite para entrar.
 */
export function Navbar({ profile, isDemo = false }: { profile: Profile | null; isDemo?: boolean }) {
  const basePath = isDemo ? DEMO_BASE_PATH : ""

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
        <div className="flex items-center gap-6">
          <Link
            href={basePath || "/"}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
          >
            <Wordmark />
          </Link>
          <NavLinks hideUsers={isDemo} basePath={basePath} />
        </div>

        {isDemo ? (
          <a
            href="/login"
            className="rounded-md border border-line px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-dim hover:text-foreground"
          >
            Entrar
          </a>
        ) : profile ? (
          <UserMenu
            name={displayNameOf(profile)}
            username={profile.username}
            avatarUrl={profile.avatar_url}
          />
        ) : null}
      </div>
    </header>
  )
}
