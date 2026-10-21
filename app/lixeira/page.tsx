import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { TrashView } from "@/components/trash/trash-view"
import { TRASH_NOT_READY } from "@/lib/domain/trash"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyTrash } from "@/lib/queries/trash"

export const metadata: Metadata = { title: "Lixeira · Vitrine" }

/**
 * `/lixeira` — pastas, categorias e subpastas apagadas (migração 37), por 30
 * dias: restaurar, excluir agora ou esvaziar. Só a própria pessoa vê.
 */
export default async function TrashPage() {
  await requireUser()
  const [profile, { ready, items }] = await Promise.all([getMyProfile(), getMyTrash()])

  return (
    <AppShell profile={profile}>
      <TrashView
        items={items}
        now={new Date().toISOString()}
        notReady={ready ? null : TRASH_NOT_READY}
      />
    </AppShell>
  )
}
