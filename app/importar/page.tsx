import type { Metadata } from "next"

import { ImportView } from "@/components/import/import-view"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Importar · Vitrine" }

/**
 * `/importar` — trazer o que já está em outros apps: as listas do Google
 * Maps (pelo Takeout) e os filmes do Letterboxd. Os arquivos são lidos no
 * navegador; o servidor recebe as linhas em lotes.
 */
export default async function ImportPage() {
  await requireUser()
  const profile = await getMyProfile()

  return (
    <AppShell profile={profile}>
      <PageHeader
        label="Trazer de fora"
        title="Importar"
        subtitle="O que você já guardou em outros apps, sem digitar de novo."
      />
      <ImportView />
    </AppShell>
  )
}
