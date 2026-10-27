import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  AtSign,
  ChevronRight,
  Clapperboard,
  Eye,
  BookOpen,
  FileText,
  FileUp,
  Gamepad2,
  KeyRound,
  LogOut,
  Mail,
  Shield,
  Smartphone,
  Tag,
  Trash2,
  UserCog,
  UserX,
} from "lucide-react"
import type { ReactNode } from "react"

import { signOutAction } from "@/app/actions"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { AppShell } from "@/components/layout/app-shell"
import { BackupForm } from "@/components/layout/backup-form"
import { DeleteAccountForm } from "@/components/layout/delete-account-form"
import { EmptyState } from "@/components/layout/empty-state"
import { LetterboxdConnection } from "@/components/layout/letterboxd-connection"
import { PageHeader } from "@/components/layout/page-header"
import { PrivacyDefaultForm } from "@/components/layout/privacy-default-form"
import { SettingsForm } from "@/components/layout/settings-form"
import { SteamConnection } from "@/components/layout/steam-connection"
import { InstallSettings } from "@/components/pwa/install"
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-list"
import { ProfileEditPanel } from "@/components/social/profile-edit-panel"
import { HowTo } from "@/components/settings/how-to"
import { TagsView } from "@/components/tag/tags-view"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { formatDateBR } from "@/lib/domain/format"
import { defaultVisibilityOf, VISIBILITY_LABELS } from "@/lib/domain/privacy"
import { timeAgo } from "@/lib/domain/social"
import { STEAM_RETURN_MESSAGES } from "@/lib/domain/steam"
import { TERMS_VERSION } from "@/lib/domain/terms"
import { TMDB_CREDIT } from "@/lib/domain/tmdb"
import type { Profile } from "@/lib/domain/types"
import { profilePath, usernameAllowanceText } from "@/lib/domain/username"
import { getCollections } from "@/lib/queries/collections"
import { getLetterboxdAccount, getSteamAccount } from "@/lib/queries/connected"
import {
  displayNameOf,
  getMyProfile,
  getMyUsernameAllowance,
  requireUser,
} from "@/lib/queries/session"
import { getTagsWithUsage } from "@/lib/queries/tags"
import { getMyTrashCount } from "@/lib/queries/trash"
import { serverSecret, steamConfigured } from "@/lib/steam/client"
import { tmdbApiKey } from "@/lib/tmdb/client"

export const metadata: Metadata = { title: "Configurações · Vitrine" }

/** Cada seção abre em `?secao=…`, no lugar da lista (um endereço só, um loading só). */
const SECTIONS = {
  perfil: {
    title: "Editar perfil",
    subtitle: "O que todo mundo vê no seu perfil, até sem conta.",
  },
  usuario: { title: "Nome de usuário", subtitle: null },
  senha: {
    title: "Senha",
    subtitle:
      "Quem entrava pelo link do e-mail ainda não tem senha: crie a sua aqui. Ao salvar, as outras sessões da conta (outros aparelhos) são encerradas.",
  },
  privacidade: {
    title: "Quem vê o que você cria",
    subtitle:
      "O padrão para as próximas pastas e categorias. Cada uma muda no selo ao lado do nome.",
  },
  steam: {
    title: "Steam",
    subtitle: "Traz seus jogos de verdade, com as horas jogadas, para uma categoria sua.",
  },
  letterboxd: {
    title: "Letterboxd",
    subtitle:
      "Traz os filmes do seu diário, com nota, pôster e resenha — e, aos poucos, diretor, gênero, duração, país e sinopse — para uma categoria sua.",
  },
  backup: {
    title: "Backup",
    subtitle: "O acervo inteiro num arquivo: exporte quando quiser e importe de volta.",
  },
  tags: { title: "Tags", subtitle: null },
  app: { title: "Instalar no celular", subtitle: null },
  excluir: { title: "Excluir minha conta", subtitle: null },
  ajuda: {
    title: "Como usar",
    subtitle: "O Vitrine em poucos minutos. Toque num assunto para abrir.",
  },
} as const

type Section = keyof typeof SECTIONS

function sectionOf(raw: unknown): Section | null {
  return typeof raw === "string" && Object.hasOwn(SECTIONS, raw) ? (raw as Section) : null
}

type SearchParams = Promise<{
  secao?: string | string[]
  /** O recado da volta do login da Steam (`?secao=steam&steam=ok`). */
  steam?: string | string[]
}>

/**
 * `/configuracoes` — uma lista só, em grupos (Conta, Privacidade, Apps e
 * importação, Seus dados, Sobre), com o valor de cada coisa à vista. Cada
 * linha abre a sua seção (`?secao=…`) com o formulário de sempre. O "Editar
 * perfil" também mora aqui (o botão do perfil traz para cá).
 */
export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const query = await searchParams
  const section = sectionOf(query.secao)
  const profile = await getMyProfile()

  if (!profile) {
    return (
      <AppShell profile={profile}>
        <PageHeader title="Configurações" />
        <EmptyState
          icon={UserCog}
          title="Perfil não encontrado"
          description="Rode o 01_schema.sql no Supabase: é ele que cria o perfil de quem já foi convidado."
        />
      </AppShell>
    )
  }

  if (section) {
    const info = SECTIONS[section]
    const back =
      section === "perfil"
        ? { href: profilePath(profile.username), label: "Perfil" }
        : { href: "/configuracoes", label: "Configurações" }
    return (
      <AppShell profile={profile}>
        <div className="mx-auto max-w-2xl pt-6 pb-16">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {back.label}
          </Link>
          <PageHeader title={info.title} subtitle={info.subtitle ?? undefined} className="pt-4" />
          <SectionBody
            section={section}
            profile={profile}
            userId={user.id}
            steamStatus={query.steam}
          />
        </div>
      </AppShell>
    )
  }

  const [steam, letterboxd, trashCount, tags] = await Promise.all([
    getSteamAccount(user.id),
    getLetterboxdAccount(user.id),
    getMyTrashCount(),
    getTagsWithUsage(),
  ])
  const name = displayNameOf(profile)
  const termsAccepted =
    profile.terms_version === TERMS_VERSION && profile.terms_accepted_at
      ? `aceitos em ${formatDateBR(profile.terms_accepted_at)}`
      : null

  return (
    <AppShell profile={profile}>
      <div className="mx-auto max-w-2xl pb-16">
        <PageHeader title="Configurações" />

        <Link
          href="/configuracoes?secao=perfil"
          className="mb-8 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-hi"
        >
          <Avatar name={name} src={profile.avatar_url} size={56} />
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-xl">{name}</span>
            <span className="block truncate text-sm text-muted-foreground">
              @{profile.username} · Editar perfil
            </span>
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-faint" />
        </Link>

        <div className="space-y-7">
          <SettingsGroup title="Conta">
            <SettingsRow
              icon={AtSign}
              label="Nome de usuário"
              value={`@${profile.username}`}
              href="/configuracoes?secao=usuario"
            />
            <SettingsRow icon={Mail} label="E-mail" value={user.email} />
            <SettingsRow icon={KeyRound} label="Senha" href="/configuracoes?secao=senha" />
          </SettingsGroup>

          <SettingsGroup title="Privacidade">
            <SettingsRow
              icon={Eye}
              label="Quem vê o que você cria"
              value={VISIBILITY_LABELS[defaultVisibilityOf(profile)]}
              href="/configuracoes?secao=privacidade"
            />
          </SettingsGroup>

          <SettingsGroup title="Apps e importação">
            <SettingsRow
              icon={Gamepad2}
              label="Steam"
              value={steam.account ? (steam.account.displayName ?? "Conectada") : null}
              href="/configuracoes?secao=steam"
            />
            <SettingsRow
              icon={Clapperboard}
              label="Letterboxd"
              value={letterboxd.account ? `@${letterboxd.account.externalId}` : null}
              href="/configuracoes?secao=letterboxd"
            />
            <SettingsRow
              icon={FileUp}
              label="Exportar ou importar backup"
              href="/configuracoes?secao=backup"
            />
          </SettingsGroup>

          <SettingsGroup title="Seus dados">
            <SettingsRow
              icon={Tag}
              label="Tags"
              value={tags.length > 0 ? String(tags.length) : null}
              href="/configuracoes?secao=tags"
            />
            <SettingsRow
              icon={Trash2}
              label="Lixeira"
              value={trashCount > 0 ? String(trashCount) : null}
              href="/lixeira"
            />
            <SettingsRow
              icon={Smartphone}
              label="Instalar no celular"
              href="/configuracoes?secao=app"
            />
          </SettingsGroup>

          <SettingsGroup title="Sobre">
            <SettingsRow icon={BookOpen} label="Como usar" href="/configuracoes?secao=ajuda" />
            <SettingsRow
              icon={FileText}
              label="Termos de uso"
              value={termsAccepted}
              href="/termos"
            />
            <SettingsRow icon={Shield} label="Política de privacidade" href="/privacidade" />
          </SettingsGroup>

          <div className="space-y-2">
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                <LogOut className="size-4" /> Sair
              </Button>
            </form>
            <SettingsGroup>
              <SettingsRow
                icon={UserX}
                label="Excluir minha conta"
                href="/configuracoes?secao=excluir"
                danger
              />
            </SettingsGroup>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

/** O conteúdo de uma seção: só o que ela usa é lido do banco. */
async function SectionBody({
  section,
  profile,
  userId,
  steamStatus,
}: {
  section: Section
  profile: Profile
  userId: string
  steamStatus: string | string[] | undefined
}): Promise<ReactNode> {
  switch (section) {
    case "perfil": {
      const { categories, folders, counts } = await getCollections(userId)
      return (
        <ProfileEditPanel
          profile={profile}
          categories={categories}
          folders={folders}
          counts={counts}
          closeHref={profilePath(profile.username)}
        />
      )
    }
    case "usuario": {
      const allowance = await getMyUsernameAllowance(userId)
      return (
        <SettingsForm
          profile={profile}
          usernameRule={usernameAllowanceText(allowance)}
          usernameChangesLeft={allowance.remaining}
        />
      )
    }
    case "senha":
      return <NewPasswordForm mode="settings" />
    case "privacidade":
      return <PrivacyDefaultForm defaultVisibility={defaultVisibilityOf(profile)} />
    case "steam": {
      const steam = await getSteamAccount(userId)
      // "sem-chave" e "sem-banco" o próprio bloco da Steam já explica: sem recado em dobro.
      const status = typeof steamStatus === "string" ? steamStatus : ""
      const notice = ["sem-chave", "sem-banco"].includes(status)
        ? null
        : (STEAM_RETURN_MESSAGES[status] ?? null)
      return (
        <SteamConnection
          ready={steam.ready}
          configured={steamConfigured()}
          account={steam.account}
          syncedLabel={syncedLabel(steam.account?.lastSyncedAt ?? null)}
          notice={notice}
        />
      )
    }
    case "letterboxd": {
      const letterboxd = await getLetterboxdAccount(userId)
      return (
        <div className="space-y-6">
          <LetterboxdConnection
            ready={letterboxd.ready}
            configured={serverSecret() !== null}
            account={letterboxd.account}
            syncedLabel={syncedLabel(letterboxd.account?.lastSyncedAt ?? null, true)}
          />
          {/* O crédito que os termos do TMDB pedem, onde os dados dele entram. */}
          {tmdbApiKey() ? (
            <p className="text-xs leading-relaxed text-faint">{TMDB_CREDIT}</p>
          ) : null}
        </div>
      )
    }
    case "backup":
      return <BackupForm />
    case "tags":
      return <TagsView tags={await getTagsWithUsage()} embedded />
    case "app":
      return <InstallSettings />
    case "ajuda":
      return <HowTo />
    case "excluir":
      return <DeleteAccountForm username={profile.username} />
  }
}

/**
 * "atualizada há 3 h" (a Steam) / "atualizado há 3 h" (o Letterboxd) —
 * calculado aqui, no servidor, para a hidratação bater.
 */
function syncedLabel(lastSyncedAt: string | null, masculine = false): string {
  if (!lastSyncedAt) return "ainda não sincronizou"
  const label = timeAgo(lastSyncedAt, new Date())
  const relative = label === "agora" || label.startsWith("há")
  const word = masculine ? "atualizado" : "atualizada"
  return relative ? `${word} ${label}` : `${word} em ${label}`
}
