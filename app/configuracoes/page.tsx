import type { Metadata } from "next"
import Link from "next/link"
import { Download, UserCog } from "lucide-react"

import { NewPasswordForm } from "@/components/auth/new-password-form"
import { AppShell } from "@/components/layout/app-shell"
import { BackupForm } from "@/components/layout/backup-form"
import { DeleteAccountForm } from "@/components/layout/delete-account-form"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PrivacyDefaultForm } from "@/components/layout/privacy-default-form"
import { ProfileCardForm } from "@/components/layout/profile-card-form"
import { SettingsForm } from "@/components/layout/settings-form"
import { SocialLinksForm } from "@/components/layout/social-links-form"
import { SteamConnection } from "@/components/layout/steam-connection"
import { InstallSettings } from "@/components/pwa/install"
import { buttonVariants } from "@/components/ui/button"
import { cardCategoryOptions, socialInputValue, SOCIAL_PROVIDERS } from "@/lib/domain/card"
import { formatDateBR } from "@/lib/domain/format"
import { timeAgo } from "@/lib/domain/social"
import { STEAM_RETURN_MESSAGES } from "@/lib/domain/steam"
import { defaultVisibilityOf } from "@/lib/domain/privacy"
import { TERMS_VERSION } from "@/lib/domain/terms"
import { usernameAllowanceText } from "@/lib/domain/username"
import { getCollections } from "@/lib/queries/collections"
import { getSteamAccount } from "@/lib/queries/connected"
import { getMyProfile, getMyUsernameAllowance, requireUser } from "@/lib/queries/session"
import type { Profile } from "@/lib/domain/types"
import { steamConfigured } from "@/lib/steam/client"

export const metadata: Metadata = { title: "Configurações · Vitrine" }

const LEGAL_LINK = "text-foreground underline underline-offset-2 transition-colors hover:text-brand"

type SearchParams = Promise<{ steam?: string | string[] }>

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const [profile, allowance, collections, steam, params] = await Promise.all([
    getMyProfile(),
    getMyUsernameAllowance(user.id),
    getCollections(user.id),
    getSteamAccount(user.id),
    searchParams,
  ])
  const { categories, folders, counts } = collections
  // "sem-chave" e "sem-banco" o próprio bloco da Steam já explica: sem recado em dobro.
  const steamStatus = typeof params.steam === "string" ? params.steam : ""
  const steamNotice = ["sem-chave", "sem-banco"].includes(steamStatus)
    ? null
    : (STEAM_RETURN_MESSAGES[steamStatus] ?? null)

  return (
    <AppShell profile={profile}>
      <PageHeader label="Conta" title="Configurações" subtitle="Como você aparece na Vitrine." />

      {profile ? (
        <div className="space-y-10">
          <SettingsForm
            profile={profile}
            usernameRule={usernameAllowanceText(allowance)}
            usernameChangesLeft={allowance.remaining}
          />
          <div
            id="cartao"
            className="max-w-[34rem] scroll-mt-20 space-y-4 border-t border-line pt-8"
          >
            <div className="space-y-1">
              <p className="plaque">Perfil</p>
              <h2 className="display text-xl">Cartão de apresentação</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Fica no topo do seu perfil e todo mundo vê, mesmo sem conta. Dá para postar no
                story pelo botão do perfil.
              </p>
            </div>
            <ProfileCardForm
              username={profile.username}
              ready={profile.card_category_ids !== undefined}
              initialBio={profile.bio ?? ""}
              initialIds={profile.card_category_ids ?? []}
              options={cardCategoryOptions(categories, folders).map((category) => ({
                id: category.id,
                name: category.name,
                icon: category.icon,
                total: counts[category.id] ?? 0,
              }))}
              names={Object.fromEntries(categories.map((category) => [category.id, category.name]))}
            />
          </div>
          <div
            id="aplicativos"
            className="max-w-[34rem] scroll-mt-20 space-y-5 border-t border-line pt-8"
          >
            <div className="space-y-1">
              <p className="plaque">Aplicativos conectados</p>
              <h2 className="display text-xl">Steam e redes</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A Steam traz seus jogos de verdade; as outras redes são só o link no seu cartão.
              </p>
            </div>
            <SteamConnection
              ready={steam.ready}
              configured={steamConfigured()}
              account={steam.account}
              syncedLabel={syncedLabel(steam.account?.lastSyncedAt ?? null)}
              notice={steamNotice}
            />
            <SocialLinksForm initialLinks={linkInputs(profile)} />
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

/** "atualizada há 3 h" — calculado aqui, no servidor, para a hidratação bater. */
function syncedLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "ainda não sincronizou"
  const label = timeAgo(lastSyncedAt, new Date())
  const relative = label === "agora" || label.startsWith("há")
  return relative ? `atualizada ${label}` : `atualizada em ${label}`
}

/** Os links gravados, do jeito que cada campo mostra ao abrir. */
function linkInputs(profile: Profile) {
  const stored = profile.social_links ?? {}
  return Object.fromEntries(
    SOCIAL_PROVIDERS.map((provider) => {
      const value = stored[provider]
      return [provider, typeof value === "string" ? socialInputValue(provider, value) : ""]
    })
  ) as Record<(typeof SOCIAL_PROVIDERS)[number], string>
}
