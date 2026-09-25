import type { Metadata } from "next"
import { UserCog } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { BackupForm } from "@/components/layout/backup-form"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { SettingsForm } from "@/components/layout/settings-form"
import { DEMO_USERNAME } from "@/lib/demo/config"
import { getMyProfile, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Configurações · Vitrine" }

export default async function SettingsPage() {
  await requireUser()
  const profile = await getMyProfile()
  const isDemo = profile?.username === DEMO_USERNAME

  return (
    <AppShell profile={profile}>
      <PageHeader label="Conta" title="Configurações" subtitle="Como você aparece na Vitrine." />

      {profile ? (
        <div className="space-y-10">
          <SettingsForm profile={profile} isDemo={isDemo} />
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Backup</p>
              <h2 className="display text-xl">Exportar e importar</h2>
            </div>
            <BackupForm hideImport={isDemo} />
          </div>
        </div>
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
