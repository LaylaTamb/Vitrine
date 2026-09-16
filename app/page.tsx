import { CollectionsView } from "@/components/collection/collections-view"
import { AppShell } from "@/components/layout/app-shell"
import { itemCount, plural } from "@/lib/domain/format"
import { getCollections } from "@/lib/queries/collections"
import { displayNameOf, requireUser } from "@/lib/queries/session"

/**
 * `/` — Coleções.
 *
 * Server Component: perfil, pastas, categorias e contagens chegam em uma única
 * ida ao banco (as quatro consultas vão juntas em `Promise.all`), e o HTML da
 * primeira resposta já sai com tudo. Daqui para frente, navegar entre níveis é
 * estado de cliente: não recarrega do servidor.
 */
export default async function CollectionsPage() {
  const user = await requireUser()
  const { profile, folders, categories, counts } = await getCollections(user.id)

  const totalEntries = Object.values(counts).reduce((acc, value) => acc + value, 0)
  const subtitle =
    categories.length === 0
      ? "Suas coleções"
      : `${plural(categories.length, "categoria", "categorias")} · ${itemCount(totalEntries)}`

  return (
    <AppShell profile={profile}>
      <CollectionsView
        folders={folders}
        categories={categories}
        counts={counts}
        canEdit
        headerLabel="Perfil"
        headerTitle={displayNameOf(profile)}
        headerSubtitle={subtitle}
      />
    </AppShell>
  )
}
