import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SharePanel } from "@/components/share/share-panel"
import { sharedName } from "@/lib/domain/share"
import { getShareData } from "@/lib/queries/share"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Salvar no Vitrine" }

type SearchParams = Promise<{ title?: string; text?: string; url?: string }>

/**
 * `/compartilhar` — o destino do botão "Compartilhar" do Android (o
 * `share_target` do manifest). O que chega vira o Nome; a pessoa escolhe onde
 * guardar com um toque. Exige login: sem sessão, o middleware leva ao login e
 * volta para cá com o texto.
 */
export default async function SharePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const params = await searchParams
  const name = sharedName(params)
  const [data, profile] = await Promise.all([getShareData(user.id, name), getMyProfile()])

  return (
    <AppShell profile={profile}>
      <SharePanel
        initialName={name}
        categories={data.categories}
        suggestedId={data.suggestedId}
      />
    </AppShell>
  )
}
