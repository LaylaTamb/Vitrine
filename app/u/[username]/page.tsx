import type { Metadata } from "next"
import { UserX } from "lucide-react"

import { CollectionsView } from "@/components/collection/collections-view"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { itemCount, plural } from "@/lib/domain/format"
import { getCollectionsByUsername } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  return { title: `@${username} · Vitrine` }
}

/** `/u/[username]` — o acervo de outra pessoa, somente leitura. */
export default async function PublicCollectionsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const user = await requireUser()

  const [{ profile, folders, categories, counts }, myProfile] = await Promise.all([
    getCollectionsByUsername(username),
    getMyProfile(),
  ])

  if (!profile) {
    return (
      <AppShell profile={myProfile}>
        <div className="py-16">
          <EmptyState
            icon={UserX}
            title="Perfil não encontrado"
            description={`Ninguém por aqui atende por @${username}.`}
          />
        </div>
      </AppShell>
    )
  }

  const name = profile.display_name || profile.username
  const totalEntries = Object.values(counts).reduce((acc, value) => acc + value, 0)

  return (
    <AppShell profile={myProfile}>
      <CollectionsView
        folders={folders}
        categories={categories}
        counts={counts}
        canEdit={profile.id === user.id}
        headerLabel="Perfil"
        headerTitle={profile.id === user.id ? name : `Acervo de ${name}`}
        headerSubtitle={
          categories.length === 0
            ? `@${profile.username}`
            : `${plural(categories.length, "categoria", "categorias")} · ${itemCount(totalEntries)}`
        }
      />
    </AppShell>
  )
}
