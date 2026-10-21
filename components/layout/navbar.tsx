import Link from "next/link"
import { Suspense } from "react"

import type { VisitorInfo } from "@/components/layout/app-shell"
import { NavLinks } from "@/components/layout/nav-links"
import { UserMenu } from "@/components/layout/user-menu"
import { Wordmark } from "@/components/layout/wordmark"
import { NotificationsBell } from "@/components/social/notifications-bell"
import { NotificationsMenu } from "@/components/social/notifications-menu"
import { buttonVariants } from "@/components/ui/button"
import { displayNameOf } from "@/lib/queries/session"
import type { Profile } from "@/lib/domain/types"

/**
 * `visitor`: página pública sem login — sem os links do app (todos pedem
 * conta) e, no lugar do menu, Entrar (que volta para esta página) e Criar
 * conta.
 */
export function Navbar({ profile, visitor }: { profile: Profile | null; visitor?: VisitorInfo }) {
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
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <Link
            href="/"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim"
          >
            <Wordmark />
          </Link>
          {visitor ? null : <NavLinks />}
        </div>

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
        ) : profile ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <Suspense fallback={<NotificationsMenu initialCount={0} />}>
              <NotificationsBell />
            </Suspense>
            <UserMenu
              name={displayNameOf(profile)}
              username={profile.username}
              avatarUrl={profile.avatar_url}
            />
          </div>
        ) : null}
      </div>
    </header>
  )
}
