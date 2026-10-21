"use client"

import Link from "next/link"
import { Compass, Download, Search, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { copyCategoryAction, exploreAction } from "@/app/explorar/actions"
import { EmptyState } from "@/components/layout/empty-state"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { copySummary, takeLabel, type ExploreCategory } from "@/lib/domain/explore"
import { formatRating, itemCount } from "@/lib/domain/format"
import { usedByLabel, type TemplateSort } from "@/lib/domain/templates"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

type Listing = "popular" | "recent"

/** Quantos campos aparecem no cartão antes do "+N". */
const PREVIEW_FIELDS = 5

/**
 * A tela do Explorar. A primeira lista (as mais copiadas) chega pronta do
 * servidor; buscar ou trocar a ordem pede a próxima ao banco.
 */
export function ExploreView({
  initial,
  notReady,
}: {
  initial: ExploreCategory[]
  /** A migração 26 não rodou: o recado no lugar da lista. */
  notReady: string | null
}) {
  const [query, setQuery] = useState("")
  const [listing, setListing] = useState<Listing>("popular")
  const [results, setResults] = useState(initial)
  const [error, setError] = useState(notReady)
  const [loading, setLoading] = useState(false)
  // A primeira lista já veio do servidor: não busca de novo ao abrir.
  const firstRun = useRef(true)

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
        setResults(result.data ?? [])
      },
      query ? 300 : 0
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, listing])

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bares, séries, trilhas…"
            aria-label="Buscar categorias pelo nome"
            className="pl-9"
          />
        </div>
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
            "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
            loading && "opacity-60 transition-opacity"
          )}
          aria-busy={loading}
        >
          {results.map((category) => (
            <li key={category.id} className="min-w-0">
              <ExploreCard category={category} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExploreCard({ category }: { category: ExploreCategory }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const fields = category.estrutura.slice(0, PREVIEW_FIELDS)
  const hidden = category.estrutura.length - fields.length

  async function take() {
    setPending(true)
    const result = await copyCategoryAction({ sourceId: category.id })
    if (!result.ok || !result.data) {
      setPending(false)
      toast.error(result.ok ? "Não deu para copiar agora." : result.error)
      return
    }
    toast.success(`“${category.name}” é sua agora. ${copySummary(result.data.copied, result.data.total)}`)
    router.push(`/categoria/${result.data.categoryId}`)
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-2xl leading-none">
          {category.icon || "📁"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{category.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <Link
              href={profilePath(category.owner.username)}
              className="hover:text-foreground hover:underline"
            >
              @{category.owner.username}
            </Link>
          </p>
          <p className="text-xs text-faint">
            {itemCount(category.total)} · {usedByLabel(category.uses)}
          </p>
        </div>
      </div>

      {category.preview.length > 0 ? (
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

      {fields.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Campos">
          {fields.map((field) => (
            <li
              key={field.id}
              className="max-w-full truncate rounded-full border border-line px-2 py-0.5 text-xs text-muted-foreground"
            >
              {field.nome}
            </li>
          ))}
          {hidden > 0 ? <li className="px-1 py-0.5 text-xs text-faint">+{hidden}</li> : null}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={take} disabled={pending}>
          <Download className="size-4" />
          {pending ? "Copiando…" : takeLabel(category.total)}
        </Button>
        <Link
          href={`/categoria/${category.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Ver
        </Link>
      </div>
    </div>
  )
}
