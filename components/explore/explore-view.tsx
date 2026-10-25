"use client"

import Link from "next/link"
import { Compass, Download, Search, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { copyCategoryAction, exploreAction } from "@/app/explorar/actions"
import { CoverMosaic } from "@/components/collection/collection-card"
import { EmptyState } from "@/components/layout/empty-state"
import { FollowButton } from "@/components/social/follow-button"
import { PersonRow } from "@/components/social/person-row"
import { Avatar } from "@/components/ui/avatar-image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { copySummary, exploreThemes, takeLabel, type ExploreCategory } from "@/lib/domain/explore"
import { formatRating, itemCount } from "@/lib/domain/format"
import { isSearching, normalizeSearch, searchByName } from "@/lib/domain/search"
import { usedByLabel, type TemplateSort } from "@/lib/domain/templates"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

type Listing = "popular" | "recent"

interface Person {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

/** Quantas pessoas a fileira "Pessoas para seguir" mostra antes do "Ver todas". */
const SUGGESTED_PEOPLE = 12

/**
 * O Descobrir: o antigo Explorar e a antiga Pessoas numa tela, com uma busca
 * só. As pessoas chegam todas do servidor e a busca delas roda aqui; a primeira
 * lista de categorias (as mais copiadas) também chega pronta, e buscar ou
 * trocar a ordem pede a próxima ao banco.
 */
export function ExploreView({
  initial,
  initialCovers,
  notReady,
  people,
  following,
  followers,
}: {
  initial: ExploreCategory[]
  /** category_id → até 3 fotos (migração 40). */
  initialCovers: Record<string, string[]>
  /** A migração 26 não rodou: o recado no lugar da lista. */
  notReady: string | null
  /** Todo mundo, menos você. */
  people: Person[]
  /** Os ids de quem você segue e de quem segue você. */
  following: string[]
  followers: string[]
}) {
  const [query, setQuery] = useState("")
  const [listing, setListing] = useState<Listing>("popular")
  const [results, setResults] = useState(initial)
  const [covers, setCovers] = useState(initialCovers)
  const [error, setError] = useState(notReady)
  const [loading, setLoading] = useState(false)
  const [allPeople, setAllPeople] = useState(false)
  // A primeira lista já veio do servidor: não busca de novo ao abrir.
  const firstRun = useRef(true)

  const followingSet = useMemo(() => new Set(following), [following])
  const followersSet = useMemo(() => new Set(followers), [followers])
  // Os temas saem da primeira lista (as em alta): não mudam enquanto você busca.
  const themes = useMemo(() => exploreThemes(initial), [initial])
  const searchingPeople = isSearching(query)
  const peopleHits = useMemo(
    () =>
      searchingPeople
        ? searchByName(
            people.map((person) => ({
              ...person,
              name: `${person.display_name ?? ""} ${person.username}`.trim(),
            })),
            query
          )
        : [],
    [people, query, searchingPeople]
  )
  // Quem você ainda não segue — quem já segue você primeiro (é só seguir de volta).
  const suggested = useMemo(
    () =>
      people
        .filter((person) => !followingSet.has(person.id))
        .sort((a, b) => Number(followersSet.has(b.id)) - Number(followersSet.has(a.id)))
        .slice(0, SUGGESTED_PEOPLE),
    [people, followingSet, followersSet]
  )

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    let alive = true
    const sort: TemplateSort = query.trim() ? "relevance" : listing
    const timer = setTimeout(
      async () => {
        setLoading(true)
        const result = await exploreAction({ query: query.trim(), sort })
        if (!alive) return
        setLoading(false)
        if (!result.ok) {
          setError(result.error)
          setResults([])
          return
        }
        setError(null)
        setResults(result.data?.results ?? [])
        setCovers(result.data?.covers ?? {})
      },
      query ? 300 : 0
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, listing])

  const personRow = (person: Person) => (
    <PersonRow
      key={person.id}
      person={person}
      isMe={false}
      following={followingSet.has(person.id)}
      followsMe={followersSet.has(person.id)}
    />
  )

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pessoas e categorias…"
            aria-label="Buscar pessoas e categorias"
            className="h-12 pl-10 text-base"
          />
        </div>
        {themes.length > 0 ? (
          <div
            role="group"
            aria-label="Temas"
            className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]"
          >
            <ThemeChip active={!query.trim()} onClick={() => setQuery("")}>
              Tudo
            </ThemeChip>
            {themes.map((theme) => (
              <ThemeChip
                key={theme.name}
                active={normalizeSearch(query) === normalizeSearch(theme.name)}
                onClick={() => setQuery(theme.name)}
              >
                {theme.icon ? `${theme.icon} ` : ""}
                {theme.name}
              </ThemeChip>
            ))}
          </div>
        ) : null}
      </div>

      <section aria-labelledby="descobrir-pessoas" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="descobrir-pessoas" className="display text-2xl">
            {searchingPeople ? "Pessoas" : "Pessoas para seguir"}
          </h2>
          {!searchingPeople && people.length > 0 ? (
            <button
              type="button"
              onClick={() => setAllPeople((open) => !open)}
              className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {allPeople ? "Ver menos" : `Ver todas (${people.length})`}
            </button>
          ) : null}
        </div>

        {searchingPeople ? (
          peopleHits.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">{peopleHits.map(personRow)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém com esse nome ou @.</p>
          )
        ) : allPeople ? (
          <ul className="grid gap-2 sm:grid-cols-2">{people.map(personRow)}</ul>
        ) : suggested.length > 0 ? (
          <ul className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
            {suggested.map((person) => (
              <li key={person.id} className="w-40 shrink-0">
                <PersonCard person={person} followsMe={followersSet.has(person.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {people.length > 0
              ? "Você já segue todo mundo daqui."
              : "Quando mais gente criar conta, ela aparece aqui."}
          </p>
        )}
      </section>

      <section aria-labelledby="descobrir-categorias" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="descobrir-categorias" className="display text-2xl">
            {query.trim()
              ? "Categorias"
              : listing === "popular"
                ? "Categorias em alta"
                : "Categorias novas"}
          </h2>
          {query.trim() ? null : (
            <div
              role="group"
              aria-label="Ordem"
              className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
            >
              {(["popular", "recent"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setListing(value)}
                  aria-pressed={listing === value}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    listing === value
                      ? "bg-brand-wash text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value === "popular" ? "Mais copiadas" : "Mais novas"}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
            {error}
          </p>
        ) : results.length === 0 && !loading ? (
          <EmptyState
            icon={Compass}
            title={query.trim() ? "Nada com esse nome" : "Nada para explorar ainda"}
            description={
              query.trim()
                ? "Nenhuma categoria pública com esse nome. Tente outra palavra."
                : "Aqui aparecem as categorias Públicas, com pelo menos um item, de outras pessoas (as suas não entram). Quando alguém deixar uma assim, ela aparece aqui."
            }
          />
        ) : (
          <ul
            className={cn(
              "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
              loading && "opacity-60 transition-opacity"
            )}
            aria-busy={loading}
          >
            {results.map((category) => (
              <li key={category.id} className="min-w-0">
                <ExploreCard category={category} photos={covers[category.id] ?? []} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ThemeChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-brand-dim bg-brand-wash text-foreground"
          : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

/** Uma pessoa na fileira "Pessoas para seguir". */
function PersonCard({ person, followsMe }: { person: Person; followsMe: boolean }) {
  const name = person.display_name || person.username
  return (
    <div className="flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
      <Link
        href={profilePath(person.username)}
        className="flex w-full min-w-0 flex-col items-center gap-2"
      >
        <Avatar name={name} src={person.avatar_url} size={64} />
        <span className="w-full min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
        </span>
      </Link>
      {followsMe ? <span className="text-xs text-faint">Segue você</span> : null}
      <div className="mt-auto pt-1">
        <FollowButton
          size="sm"
          profileId={person.id}
          username={person.username}
          following={false}
          followsMe={followsMe}
        />
      </div>
    </div>
  )
}

function ExploreCard({ category, photos }: { category: ExploreCategory; photos: string[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const href = `/categoria/${category.id}`

  async function take() {
    setPending(true)
    const result = await copyCategoryAction({ sourceId: category.id })
    if (!result.ok || !result.data) {
      setPending(false)
      toast.error(result.ok ? "Não deu para copiar agora." : result.error)
      return
    }
    toast.success(
      `“${category.name}” é sua agora. ${copySummary(result.data.copied, result.data.total)}`
    )
    router.push(`/categoria/${result.data.categoryId}`)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {/* A capa abre a categoria (o nome, embaixo, é o link para o leitor de tela). */}
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        {photos.length > 0 ? (
          <CoverMosaic photos={photos} />
        ) : (
          <span className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-surface-hi to-bg-soft text-5xl leading-none">
            {category.icon || "📁"}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2.5">
          {photos.length > 0 ? (
            <span aria-hidden className="mt-0.5 text-2xl leading-none">
              {category.icon || "📁"}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <Link
              href={href}
              className="display block truncate text-lg leading-snug text-foreground hover:text-brand"
            >
              {category.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              <Link
                href={profilePath(category.owner.username)}
                className="hover:text-foreground hover:underline"
              >
                @{category.owner.username}
              </Link>{" "}
              · {itemCount(category.total)}
            </p>
            <p className="text-xs text-faint">{usedByLabel(category.uses)}</p>
          </div>
        </div>

        {/* Sem fotos, os 3 melhores dizem do que se trata. */}
        {photos.length === 0 && category.preview.length > 0 ? (
          <ol className="space-y-1">
            {category.preview.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center gap-2 text-sm">
                <span className="w-4 shrink-0 text-xs text-faint tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                {category.ratingEnabled && item.rating !== null ? (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-brand">
                    <Star aria-hidden className="size-3 fill-current" />
                    <span className="sr-only">Nota </span>
                    {formatRating(item.rating)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={take} disabled={pending}>
            <Download className="size-4" />
            {pending ? "Copiando…" : takeLabel(category.total)}
          </Button>
          <Link href={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Ver
          </Link>
        </div>
      </div>
    </div>
  )
}
