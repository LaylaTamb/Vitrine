"use client"

import Link from "next/link"
import { FolderOpen, Search, SearchX, Star, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { searchMyItemsAction } from "@/app/actions"
import { EntryImage } from "@/components/entry/entry-image"
import { EmptyState } from "@/components/layout/empty-state"
import { Input } from "@/components/ui/input"
import { formatRating, itemCount, plural } from "@/lib/domain/format"
import {
  matchReason,
  normalizeSearch,
  pathLabel,
  searchByName,
  type ItemHit,
} from "@/lib/domain/search"
import type { Category, Folder } from "@/lib/domain/types"
import { imageTransformOf } from "@/lib/domain/view"

const ROW =
  "flex w-full min-w-0 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-hi hover:bg-surface-hi"

/** A barra de busca das Coleções. Esc limpa. */
export function CollectionsSearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative mb-4 max-w-md">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("")
        }}
        placeholder="Buscar pastas, categorias e itens…"
        aria-label="Buscar nas suas Coleções"
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar a busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Os resultados, no lugar da grade: pastas e categorias pelo nome (procuradas
 * aqui, nas listas que a tela já tem) e itens pelo nome, tags e campos (no
 * banco, `search_my_items`), cada um com o caminho até ele.
 */
export function CollectionsSearchResults({
  query,
  folders,
  categories,
  counts,
  onOpenFolder,
}: {
  query: string
  folders: Folder[]
  categories: Category[]
  counts: Record<string, number>
  onOpenFolder: (folderId: string) => void
}) {
  const key = normalizeSearch(query)
  const folderHits = useMemo(() => searchByName(folders, query), [folders, query])
  const categoryHits = useMemo(() => searchByName(categories, query), [categories, query])
  const [items, setItems] = useState<{ key: string; hits: ItemHit[]; error: string | null }>({
    key: "",
    hits: [],
    error: null,
  })
  const loading = items.key !== key
  // O texto do jeito que foi digitado vai junto; a busca recomeça só quando o
  // texto normalizado muda (acento ou espaço a mais não refaz a busca).
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    let alive = true
    const timer = setTimeout(async () => {
      const result = await searchMyItemsAction({ query: queryRef.current })
      if (!alive) return
      setItems({
        key,
        hits: result.ok ? (result.data ?? []) : [],
        error: result.ok ? null : result.error,
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key])

  const total = folderHits.length + categoryHits.length + (loading ? 0 : items.hits.length)
  const nothing = !loading && total === 0 && !items.error

  if (nothing) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Nada com “${query.trim()}”`}
        description="Nenhuma pasta, categoria ou item seu tem isso no nome, nas tags ou nos campos."
      />
    )
  }

  return (
    <div className="space-y-6 pb-16" aria-live="polite">
      {folderHits.length > 0 ? (
        <Section title="Pastas" count={folderHits.length}>
          {folderHits.map((folder) => (
            <li key={folder.id}>
              <button type="button" className={ROW} onClick={() => onOpenFolder(folder.id)}>
                <FolderOpen aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{folder.name}</span>
                  <span className="block truncate text-xs text-faint">
                    {pathLabel(folders, folder.parent_folder_id)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </Section>
      ) : null}

      {categoryHits.length > 0 ? (
        <Section title="Categorias" count={categoryHits.length}>
          {categoryHits.map((category) => (
            <li key={category.id}>
              <Link href={`/categoria/${category.id}`} className={ROW}>
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {category.icon || "📁"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{category.name}</span>
                  <span className="block truncate text-xs text-faint">
                    {pathLabel(folders, category.folder_id)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-faint">
                  {itemCount(counts[category.id] ?? 0)}
                </span>
              </Link>
            </li>
          ))}
        </Section>
      ) : null}

      {loading ? (
        <p className="text-xs text-faint">Procurando nos itens…</p>
      ) : items.error ? (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {items.error}
        </p>
      ) : items.hits.length > 0 ? (
        <Section title="Itens" count={items.hits.length}>
          {items.hits.map((hit) => {
            const reason = matchReason(hit)
            return (
              <li key={hit.id}>
                <Link href={`/categoria/${hit.categoryId}/${hit.id}`} className={ROW}>
                  <EntryImage
                    imageUrl={hit.imageUrl}
                    imageTransform={imageTransformOf(hit.imageDisplay)}
                    initial={(hit.name.trim()[0] ?? "?").toUpperCase()}
                    ratio="1 / 1"
                    initialSize="1rem"
                    className="w-10 shrink-0"
                    tint={hit.categoryColor}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{hit.name}</span>
                    <span className="block truncate text-xs text-faint">
                      em {hit.categoryIcon ? `${hit.categoryIcon} ` : ""}
                      {hit.categoryName}
                      {reason ? ` · ${reason}` : ""}
                    </span>
                  </span>
                  {hit.rating !== null ? (
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-brand">
                      <Star aria-hidden className="size-3 fill-current" />
                      <span className="sr-only">Nota </span>
                      {formatRating(hit.rating)}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </Section>
      ) : null}

      {!loading && items.hits.length >= 40 ? (
        <p className="text-xs text-faint">
          Mostrando os 40 primeiros itens. Escreva mais para afinar a busca.
        </p>
      ) : null}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="plaque">
        {title} <span className="text-faint">· {plural(count, "resultado", "resultados")}</span>
      </p>
      {/* `grid-cols-1` (e não só `grid`): sem ela, um nome comprido alarga a coluna. */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 [&>li]:min-w-0">{children}</ul>
    </section>
  )
}
