import type { Metadata } from "next"
import Link from "next/link"
import { Download, Pencil, UserCog } from "lucide-react"

import { NewPasswordForm } from "@/components/auth/new-password-form"
import { AppShell } from "@/components/layout/app-shell"
import { BackupForm } from "@/components/layout/backup-form"
import { DeleteAccountForm } from "@/components/layout/delete-account-form"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PrivacyDefaultForm } from "@/components/layout/privacy-default-form"
import { SettingsForm } from "@/components/layout/settings-form"
import { InstallSettings } from "@/components/pwa/install"
import { buttonVariants } from "@/components/ui/button"
import { formatDateBR } from "@/lib/domain/format"
import { defaultVisibilityOf } from "@/lib/domain/privacy"
import { TERMS_VERSION } from "@/lib/domain/terms"
import { profilePath, usernameAllowanceText } from "@/lib/domain/username"
import { getMyProfile, getMyUsernameAllowance, requireUser } from "@/lib/queries/session"

export const metadata: Metadata = { title: "Configurações · Vitrine" }

const LEGAL_LINK = "text-foreground underline underline-offset-2 transition-colors hover:text-brand"

/**
 * `/configuracoes` — a conta: o @, a senha, a privacidade padrão, o app, as
 * importações, o backup, os termos e excluir a conta. O cartão (foto, nome,
 * bio, destaques, redes e Steam) se edita no próprio perfil.
 */
export default async function SettingsPage() {
  const user = await requireUser()
  const [profile, allowance] = await Promise.all([
    getMyProfile(),
    getMyUsernameAllowance(user.id),
  ])

  return (
    <AppShell profile={profile}>
      <PageHeader label="Conta" title="Configurações" subtitle="A sua conta na Vitrine." />

      {profile ? (
        <div className="space-y-10">
          <div className="max-w-[34rem] space-y-4">
            <div className="space-y-1">
              <p className="plaque">Perfil</p>
              <h2 className="display text-xl">Foto, nome, bio, redes e Steam</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tudo o que aparece no seu cartão se edita no próprio perfil.
              </p>
            </div>
            <Link
              href={`${profilePath(profile.username)}?editar=1#editar`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="size-4" /> Editar cartão no Meu perfil
            </Link>
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Conta</p>
              <h2 className="display text-xl">Nome de usuário</h2>
            </div>
            <SettingsForm
              profile={profile}
              usernameRule={usernameAllowanceText(allowance)}
              usernameChangesLeft={allowance.remaining}
            />
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Senha</p>
              <h2 className="display text-xl">Definir ou trocar</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Quem entrava pelo link do e-mail ainda não tem senha: crie a sua aqui. Ao salvar,
                as outras sessões da conta (outros aparelhos) são encerradas.
              </p>
            </div>
            <NewPasswordForm mode="settings" />
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Privacidade</p>
              <h2 className="display text-xl">Novas pastas e categorias</h2>
            </div>
            <PrivacyDefaultForm defaultVisibility={defaultVisibilityOf(profile)} />
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">App no celular</p>
              <h2 className="display text-xl">Instalar o Vitrine</h2>
            </div>
            <InstallSettings />
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Importar</p>
              <h2 className="display text-xl">Do Google Maps e do Letterboxd</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                As listas salvas do Google Maps e os filmes que você já viu no Letterboxd, sem
                digitar de novo.
              </p>
            </div>
            <Link href="/importar" className={buttonVariants({ variant: "outline" })}>
              <Download className="size-4" /> Abrir Importar
            </Link>
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Backup</p>
              <h2 className="display text-xl">Exportar e importar</h2>
            </div>
            <BackupForm />
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque">Termos e privacidade</p>
              <h2 className="display text-xl">Os combinados</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                O que vale entre você e o Vitrine, e o que acontece com os seus dados:{" "}
                <Link href="/termos" className={LEGAL_LINK}>
                  Termos de uso
                </Link>{" "}
                e{" "}
                <Link href="/privacidade" className={LEGAL_LINK}>
                  Política de privacidade
                </Link>
                .
                {profile.terms_version === TERMS_VERSION && profile.terms_accepted_at
                  ? ` Você aceitou a versão em vigor em ${formatDateBR(profile.terms_accepted_at)}.`
                  : ""}
              </p>
            </div>
          </div>
          <div className="max-w-[34rem] space-y-4 border-t border-line pt-8">
            <div className="space-y-1">
              <p className="plaque text-danger">Zona de perigo</p>
              <h2 className="display text-xl">Excluir minha conta</h2>
            </div>
            <DeleteAccountForm username={profile.username} />
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
