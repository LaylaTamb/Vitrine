import type { Metadata } from "next"
import Link from "next/link"
import { Compass, Sparkles } from "lucide-react"

import { ExploreView } from "@/components/explore/explore-view"
import { FeedCard } from "@/components/feed/feed-card"
import { HomeTabs, homeTabOf } from "@/components/feed/home-tabs"
import { AppShell } from "@/components/layout/app-shell"
import { EmptyState } from "@/components/layout/empty-state"
import { HereBanner } from "@/components/nearby/here-banner"
import { PersonRow } from "@/components/social/person-row"
import { Avatar } from "@/components/ui/avatar-image"
import { buttonVariants } from "@/components/ui/button"
import { EXPLORE_NOT_READY } from "@/lib/domain/explore"
import { feedPeople, groupFeed } from "@/lib/domain/feed"
import { placeTargets } from "@/lib/domain/nearby"
import { profilePath } from "@/lib/domain/username"
import { getCoversOf, getExplore } from "@/lib/queries/explore"
import { getFeed, getMyPlaceCategories } from "@/lib/queries/feed"
import { listProfiles } from "@/lib/queries/profiles"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getMyFollows } from "@/lib/queries/social"

export const metadata: Metadata = { title: "Início · Vitrine" }

/** Quantas pessoas a coluna "Pessoas para seguir" sugere (no computador). */
const SUGGESTED = 3

type SearchParams = Promise<{ aba?: string | string[]; buscar?: string | string[] }>

/**
 * `/inicio` — o Início, com duas abas no topo:
 * - **Amigos**: o que quem você segue acabou de catalogar, em cartões (os
 *   itens de uma pessoa numa categoria, no mesmo dia, juntos), com as pessoas
 *   com novidade e o "Você está em…?"; no computador, ao lado, quem seguir.
 * - **Sugestões** (`?aba=sugestoes`, o antigo Descobrir): pessoas para seguir e
 *   categorias públicas para pegar. `&buscar=1` (a lupa do celular) já abre
 *   com o cursor na busca.
 * O app abre no seu perfil (`/`); o Início é um dos lugares da barra.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const query = await searchParams
  const tab = homeTabOf(query.aba)
  const friends = tab === "amigos"

  const [profile, mine, places, profiles, explore] = await Promise.all([
    getMyProfile(),
    getMyFollows(user.id),
    friends ? getMyPlaceCategories(user.id) : [],
    listProfiles(),
    friends ? null : getExplore(),
  ])
  // Precisam de quem você segue e dos ids das categorias: é a segunda ida. O
  // feed vem nas duas abas porque o número da aba Amigos sai dele.
  const [feed, covers] = await Promise.all([
    getFeed([...mine.following]),
    explore ? getCoversOf(explore.results.map((category) => category.id)) : {},
  ])
  const groups = groupFeed(feed)
  const people = feedPeople(groups)
  const now = new Date()
  const suggested = profiles
    .filter((person) => person.id !== user.id && !mine.following.has(person.id))
    .sort((a, b) => Number(mine.followers.has(b.id)) - Number(mine.followers.has(a.id)))
    .slice(0, SUGGESTED)

  return (
    <AppShell profile={profile}>
      <h1 className="sr-only">Início</h1>
      <div className="grid gap-8 pt-2 md:pt-4 lg:grid-cols-[minmax(0,40rem)_300px] lg:justify-center">
        <div className="min-w-0 space-y-5">
          <HomeTabs current={tab} news={people.length} />

          {explore ? (
            <ExploreView
              initial={explore.results}
              initialCovers={covers}
              notReady={explore.ready ? explore.error : EXPLORE_NOT_READY}
              people={profiles.filter((item) => item.id !== user.id)}
              following={[...mine.following]}
              followers={[...mine.followers]}
              autoFocus={query.buscar === "1"}
            />
          ) : (
            <>
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
                    <Link href="/inicio?aba=sugestoes" className={buttonVariants()}>
                      <Sparkles className="size-4" /> Ver sugestões
                    </Link>
                  }
                />
              )}
            </>
          )}
        </div>

        <aside className="hidden space-y-5 pt-2 lg:block">
          {friends ? (
            suggested.length > 0 ? (
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
                  href="/inicio?aba=sugestoes"
                  className="block pt-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  Ver mais sugestões →
                </Link>
              </section>
            ) : null
          ) : (
            <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
              <h2 className="plaque">Como funciona</h2>
              <p className="text-sm text-muted-foreground">
                “Pegar” faz uma cópia sua da categoria, com os itens. Ela continua recebendo as
                novidades de quem fez.
              </p>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
