import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { QrScreen } from "@/components/social/qr-screen"
import { displayNameOf, getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "QR · Vitrine" }

type SearchParams = Promise<{ modo?: string | string[] }>

/**
 * `/qr` — o QR pessoal (migração 22): mostrar o seu, para alguém escanear,
 * ou ler o de alguém. Escaneou, os dois viram amigos na hora. `?modo=ler`
 * abre direto na câmera.
 */
export default async function QrPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser()
  const [profile, params] = await Promise.all([getMyProfile(), searchParams])

  return (
    <AppShell profile={profile}>
      <PageHeader
        label="Amigos"
        title="QR"
        subtitle="Escaneou o QR de alguém, vocês viram amigos na hora."
      />
      {profile ? (
        <QrScreen
          name={displayNameOf(profile)}
          username={profile.username}
          avatarUrl={profile.avatar_url}
          initialMode={params.modo === "ler" ? "scan" : "show"}
        />
      ) : null}
    </AppShell>
  )
}
