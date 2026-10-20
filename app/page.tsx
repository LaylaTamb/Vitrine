import { CollectionsView } from "@/components/collection/collections-view"
import { PublicNotice } from "@/components/collection/public-notice"
import { AppShell } from "@/components/layout/app-shell"
import { HereBanner } from "@/components/nearby/here-banner"
import { itemCount, plural } from "@/lib/domain/format"
import { placeTargets } from "@/lib/domain/nearby"
import { defaultVisibilityOf, needsPublicNotice } from "@/lib/domain/privacy"
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
  // O @ sempre à vista, também no próprio perfil.
  const handle = profile ? `@${profile.username}` : "Suas coleções"
  const subtitle =
    categories.length === 0
      ? handle
      : `${handle} · ${plural(categories.length, "categoria", "categorias")} · ${itemCount(totalEntries)}`

  return (
    <AppShell profile={profile}>
      {needsPublicNotice(profile, categories, folders) ? <PublicNotice /> : null}
      {/* "Você está em X?": só aparece com a localização já autorizada. */}
      <HereBanner targets={placeTargets(categories)} />
      <CollectionsView
        folders={folders}
        categories={categories}
        counts={counts}
        canEdit
        headerLabel="Perfil"
        headerTitle={displayNameOf(profile)}
        headerSubtitle={subtitle}
        defaultVisibility={defaultVisibilityOf(profile)}
      />
    </AppShell>
  )
}
