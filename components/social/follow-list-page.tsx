import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PersonRow } from "@/components/social/person-row"
import { buttonVariants } from "@/components/ui/button"
import { normalizeUsername, profilePath } from "@/lib/domain/username"
import { getProfileByUsername } from "@/lib/queries/profiles"
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
 * `/v/<@>/seguidores` e `/v/<@>/seguindo`. As listas só aparecem com login:
 * quem segue quem não fica aberto para a internet.
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
    return (
      <AppShell profile={null} visitor={{ next }}>
        <div className="py-16">
          <EmptyState
            icon={Users}
            title={`${title} de @${username}`}
            description="Entre na sua conta para ver quem segue quem."
            action={
              <Link
                href={`/login?proximo=${encodeURIComponent(next)}`}
                className={buttonVariants()}
              >
                Entrar
              </Link>
            }
          />
        </div>
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
