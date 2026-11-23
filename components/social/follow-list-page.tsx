import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PersonRow } from "@/components/social/person-row"
import { buttonVariants } from "@/components/ui/button"
import { authHref } from "@/lib/domain/auth"
import { normalizeUsername, profilePath, USERNAME_PATTERN } from "@/lib/domain/username"
import { getProfileByUsername } from "@/lib/queries/profiles"
import { getPublicFollows } from "@/lib/queries/public"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"
import { getFollowList, getMyFollows, type FollowListKind } from "@/lib/queries/social"

function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * `/v/<@>/seguidores` e `/v/<@>/seguindo`.
 *
 * Sem conta (modo visitante, migração 50, escolha da dona): a lista abre só
 * para perfil com alguma categoria Pública — nos outros, só as contagens —, e
 * de cada pessoa só o nome, o @ e a foto (`public_follows`). Sem o 50, pede
 * para entrar, como antes.
 */
export async function FollowListPage({
  rawUsername,
  kind,
}: {
  rawUsername: string
  kind: FollowListKind
}) {
  const username = normalizeUsername(decoded(rawUsername))
  const path = profilePath(username)
  const title = kind === "seguidores" ? "Seguidores" : "Seguindo"
  const user = await getSessionUser()

  if (!user) {
    const next = `${path}/${kind}`
    const data = USERNAME_PATTERN.test(username)
      ? await getPublicFollows(username, kind === "seguidores" ? "followers" : "following")
      : null

    if (data === "missing") {
      return (
        <AppShell profile={null} visitor={{ next }}>
          <div className="py-16">
            <EmptyState
              icon={Users}
              title={`${title} de @${username}`}
              description="Entre na sua conta para ver quem segue quem."
              action={
                <Link href={authHref("/login", next)} className={buttonVariants()}>
                  Entrar
                </Link>
              }
            />
          </div>
        </AppShell>
      )
    }

    const count = data ? (kind === "seguidores" ? data.followers : data.following) : 0
    return (
      <AppShell profile={null} visitor={{ next }}>
        <PageHeader
          label={`@${username}`}
          title={title}
          subtitle={data ? `${count} ${count === 1 ? "pessoa" : "pessoas"}` : undefined}
          actions={
            <Link href={path} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ArrowLeft className="size-4" /> Voltar ao perfil
            </Link>
          }
        />
        {!data ? (
          <EmptyState
            icon={Users}
            title="Perfil não encontrado"
            description={`Ninguém por aqui atende por @${username}.`}
          />
        ) : data.hidden ? (
          <EmptyState
            icon={Users}
            title={`@${username} ainda não tem nada público`}
            description="Quem segue quem aparece quando o perfil tem alguma lista Pública."
          />
        ) : data.people.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.people.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                isMe={false}
                following={false}
                followsMe={false}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {kind === "seguidores"
              ? "Ninguém segue por enquanto."
              : "Não segue ninguém por enquanto."}
          </p>
        )}
      </AppShell>
    )
  }

  const [profile, myProfile, mine] = await Promise.all([
    getProfileByUsername(username),
    getMyProfile(),
    getMyFollows(user.id),
  ])
  const people = profile ? await getFollowList(profile.id, kind) : []
  const empty =
    kind === "seguidores" ? "Ninguém segue por enquanto." : "Não segue ninguém por enquanto."

  return (
    <AppShell profile={myProfile}>
      <PageHeader
        label={`@${username}`}
        title={title}
        subtitle={
          people.length === 0
            ? empty
            : `${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}`
        }
        actions={
          <Link href={path} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ArrowLeft className="size-4" /> Voltar ao perfil
          </Link>
        }
      />

      {!profile ? (
        <EmptyState
          icon={Users}
          title="Perfil não encontrado"
          description={`Ninguém por aqui atende por @${username}.`}
        />
      ) : people.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              isMe={person.id === user.id}
              following={mine.following.has(person.id)}
              followsMe={mine.followers.has(person.id)}
              removable={kind === "seguidores" && profile.id === user.id}
            />
          ))}
        </ul>
      ) : null}
    </AppShell>
  )
}
