"use client"

import { Search, Star } from "lucide-react"
import { useEffect, useState } from "react"

import { searchTemplatesAction } from "@/app/explorar/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FIELD_TYPE_LABELS } from "@/lib/domain/fields"
import { usedByLabel, type CategoryTemplate, type TemplateSort } from "@/lib/domain/templates"
import { cn } from "@/lib/utils"

/** Quantos campos aparecem no cartão antes do "+N". */
const PREVIEW_FIELDS = 6

type Listing = "popular" | "recent"

/**
 * "Começar de um modelo": as categorias públicas de outras pessoas, com o @
 * do autor, os campos e quantas pessoas já usaram. Sem busca, as mais usadas
 * (ou as mais novas); com busca, as de nome mais parecido primeiro.
 */
export function TemplatePicker({ onUse }: { onUse: (template: CategoryTemplate) => void }) {
  const [query, setQuery] = useState("")
  const [listing, setListing] = useState<Listing>("popular")
  const [results, setResults] = useState<CategoryTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const sort: TemplateSort = query.trim() ? "relevance" : listing
    // Espera a pessoa parar de digitar antes de buscar.
    const timer = setTimeout(
      async () => {
        const result = await searchTemplatesAction({ query: query.trim(), sort })
        if (!alive) return
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
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Vinhos, séries, trilhas…"
          aria-label="Buscar modelo pelo nome"
          className="pl-9"
          autoFocus
        />
      </div>

      {query.trim() ? null : (
        <div
          role="group"
          aria-label="Ordem dos modelos"
          className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
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
              {value === "popular" ? "Mais usados" : "Mais novos"}
            </button>
          ))}
        </div>
      )}

      {results === null ? (
        <div className="space-y-2" aria-label="Buscando modelos">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {error}
        </p>
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {query.trim()
            ? "Nenhuma categoria pública com esse nome ainda. Que tal começar do zero?"
            : "Ainda não há categorias públicas de outras pessoas para usar como modelo."}
        </p>
      ) : (
        <ul className="space-y-2">
          {results.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} onUse={() => onUse(template)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TemplateCard({ template, onUse }: { template: CategoryTemplate; onUse: () => void }) {
  const shown = template.estrutura.slice(0, PREVIEW_FIELDS)
  const hidden = template.estrutura.length - shown.length

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
      <span aria-hidden className="mt-0.5 text-xl leading-none">
        {template.icon || "📁"}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div>
          <p className="truncate font-medium text-foreground">{template.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{template.owner.username} · {usedByLabel(template.uses)}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1" aria-label="Campos">
          {template.ratingEnabled ? (
            <li className="inline-flex items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 text-xs text-brand">
              <Star aria-hidden className="size-3 fill-current" /> Estrelas
            </li>
          ) : null}
          {shown.map((field) => (
            <li
              key={field.id}
              title={FIELD_TYPE_LABELS[field.tipo]}
              className="max-w-full truncate rounded-full border border-line px-2 py-0.5 text-xs text-muted-foreground"
            >
              {field.nome}
            </li>
          ))}
          {hidden > 0 ? (
            <li className="rounded-full px-1 py-0.5 text-xs text-faint">+{hidden}</li>
          ) : null}
        </ul>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onUse} className="shrink-0">
        Usar
      </Button>
    </div>
  )
}
