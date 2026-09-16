import type { Metadata } from "next"
import { UserCog } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { SettingsForm } from "@/components/layout/settings-form"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Configurações · Vitrine" }

export default async function SettingsPage() {
  await requireUser()
  const profile = await getMyProfile()

  return (
    <AppShell profile={profile}>
      <PageHeader label="Conta" title="Configurações" subtitle="Como você aparece na Vitrine." />

      {profile ? (
        <SettingsForm profile={profile} />
      ) : (
        <EmptyState
          icon={UserCog}
          title="Perfil não encontrado"
          description="Rode o 01_schema.sql no Supabase: é ele que cria o perfil de quem já foi convidado."
        />
      )}
    </AppShell>
  )
}
