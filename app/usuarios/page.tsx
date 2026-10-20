import type { Metadata } from "next"
import Link from "next/link"
import { QrCode, ScanLine, Users } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PersonRow } from "@/components/social/person-row"
import { buttonVariants } from "@/components/ui/button"
import { listProfiles } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyFollows } from "@/lib/queries/social"

export const metadata: Metadata = { title: "Pessoas · Vitrine" }

/** `/usuarios` — todo mundo no Vitrine, com o botão de seguir. */
export default async function UsersPage() {
  const user = await requireUser()
  const [profiles, profile, mine] = await Promise.all([
    listProfiles(),
    getMyProfile(),
    getMyFollows(user.id),
  ])

  return (
    <AppShell profile={profile}>
      <PageHeader
        label="Comunidade"
        title="Pessoas"
        subtitle="Siga quem você quiser. Quem segue você de volta vira amigo."
        actions={
          <>
            <Link href="/qr" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <QrCode className="size-4" /> Meu QR
            </Link>
            <Link href="/qr?modo=ler" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ScanLine className="size-4" /> Ler QR
            </Link>
          </>
        }
      />

      {profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Ninguém por aqui"
          description="Quando mais gente criar conta, ela aparece aqui."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {profiles.map((item) => (
            <PersonRow
              key={item.id}
              person={item}
              isMe={item.id === user.id}
              following={mine.following.has(item.id)}
              followsMe={mine.followers.has(item.id)}
            />
          ))}
        </ul>
      )}
    </AppShell>
  )
}
