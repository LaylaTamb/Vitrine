import Link from "next/link"

import { NavLinks } from "@/components/layout/nav-links"
import { UserMenu } from "@/components/layout/user-menu"
import { Wordmark } from "@/components/layout/wordmark"
import { displayNameOf } from "@/lib/queries/session"
import type { Profile } from "@/lib/domain/types"

export function Navbar({ profile }: { profile: Profile | null }) {
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
          <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-dim">
            <Wordmark />
          </Link>
          <NavLinks />
        </div>

        {profile ? (
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
