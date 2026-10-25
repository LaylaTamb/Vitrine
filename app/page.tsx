import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Compass } from "lucide-react"

import { FeedCard } from "@/components/feed/feed-card"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { HereBanner } from "@/components/nearby/here-banner"
import { PersonRow } from "@/components/social/person-row"
import { Avatar } from "@/components/ui/avatar-image"
import { buttonVariants } from "@/components/ui/button"
import { feedPeople, groupFeed } from "@/lib/domain/feed"
import { placeTargets } from "@/lib/domain/nearby"
import { profilePath } from "@/lib/domain/username"
import { getFeed, getMyPlaceCategories } from "@/lib/queries/feed"
import { listProfiles } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyFollows } from "@/lib/queries/social"

export const metadata: Metadata = { title: "Início · Vitrine" }

/** Quantas pessoas a coluna "Pessoas para seguir" sugere (no computador). */
const SUGGESTED = 3

type SearchParams = Promise<{ pasta?: string | string[] }>

/**
 * `/` — o Início: o que quem você segue acabou de catalogar, em cartões
 * (os itens de uma pessoa numa categoria, no mesmo dia, juntos). No topo, as
 * pessoas com novidade e o "Você está em…?"; no computador, ao lado, quem
 * seguir. As suas Coleções moram no Perfil.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const [profile, mine, places, profiles, query] = await Promise.all([
    getMyProfile(),
    getMyFollows(user.id),
    getMyPlaceCategories(user.id),
    listProfiles(),
    searchParams,
  ])

  // Link antigo das Coleções (`/?pasta=…`): elas agora moram no Perfil.
  if (profile && typeof query.pasta === "string") {
    redirect(`${profilePath(profile.username)}?pasta=${encodeURIComponent(query.pasta)}`)
  }

  // Precisa de quem você segue: é a segunda ida.
  const groups = groupFeed(await getFeed([...mine.following]))
  const people = feedPeople(groups)
  const now = new Date()
  const suggested = profiles
    .filter((person) => person.id !== user.id && !mine.following.has(person.id))
    .sort((a, b) => Number(mine.followers.has(b.id)) - Number(mine.followers.has(a.id)))
    .slice(0, SUGGESTED)

  return (
    <AppShell profile={profile}>
      <h1 className="sr-only">Início</h1>
      <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {/* Quem tem novidade: um toque abre o perfil. */}
          {people.length > 0 ? (
            <ul
              aria-label="Quem tem novidade"
              className="flex gap-3 overflow-x-auto py-1.5 [scrollbar-width:none]"
            >
              {people.map((person) => {
                const name = person.display_name || person.username
                return (
                  <li key={person.id} className="w-16 shrink-0">
                    <Link
                      href={profilePath(person.username)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="rounded-full p-0.5 ring-2 ring-brand">
                        <Avatar name={name} src={person.avatar_url} size={52} />
                      </span>
                      <span className="w-full truncate text-center text-[0.7rem] text-muted-foreground">
                        {name.split(" ")[0]}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {/* "Você está em X?": só aparece com a localização já autorizada. */}
          <HereBanner targets={placeTargets(places)} />

          {groups.length > 0 ? (
            groups.map((group) => <FeedCard key={group.key} group={group} now={now} />)
          ) : (
            <EmptyState
              icon={Compass}
              title={mine.following.size > 0 ? "Nada novo por aqui" : "Seu Início está vazio"}
              description={
                mine.following.size > 0
                  ? "Quem você segue não catalogou nada nos últimos 30 dias (ou só o que é privado). Que tal achar mais gente?"
                  : "Siga pessoas para ver aqui o que elas catalogam: restaurantes, filmes, livros…"
              }
              action={
                <Link href="/explorar" className={buttonVariants()}>
                  <Compass className="size-4" /> Descobrir pessoas
                </Link>
              }
            />
          )}
        </div>

        <aside className="hidden space-y-5 lg:block">
          {suggested.length > 0 ? (
            <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
              <h2 className="plaque">Pessoas para seguir</h2>
              <ul className="space-y-2">
                {suggested.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    isMe={false}
                    following={false}
                    followsMe={mine.followers.has(person.id)}
                  />
                ))}
              </ul>
              <Link
                href="/explorar"
                className="block pt-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Ver mais no Descobrir
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  )
}
