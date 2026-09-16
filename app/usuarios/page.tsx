import type { Metadata } from "next"
import Link from "next/link"
import { Users } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar } from "@/components/ui/avatar-image"
import { listProfiles } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Pessoas · Vitrine" }

/** `/usuarios` — todo mundo com acesso ao app. */
export default async function UsersPage() {
  await requireUser()
  const [profiles, profile] = await Promise.all([listProfiles(), getMyProfile()])

  return (
    <AppShell profile={profile}>
      <PageHeader
        label="Grupo"
        title="Pessoas"
        subtitle="Todo mundo com acesso ao app aparece aqui."
      />

      {profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Ninguém por aqui"
          description="Convide gente pelo painel do Supabase, em Authentication → Users."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {profiles.map((item) => (
            <li key={item.id}>
              <Link
                href={`/u/${item.username}`}
                className="vitrine-card flex items-center gap-3 px-3 py-2.5"
              >
                <Avatar name={item.display_name || item.username} src={item.avatar_url} size={36} />
                <span className="min-w-0">
                  <span className="display block truncate text-base">
                    {item.display_name || item.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{item.username}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
