"use client"

import { Lock } from "lucide-react"

import { itemCount } from "@/lib/domain/format"
import type { MatchCopyInfo, MatchFilter } from "@/lib/domain/match"
import { cn } from "@/lib/utils"

const MODES: { mode: MatchFilter["mode"]; label: string }[] = [
  { mode: "all", label: "Todos" },
  { mode: "common", label: "Em comum" },
  { mode: "suggestions", label: "Sugestões para mim" },
]

/**
 * O topo da cópia de um match: a % de compatibilidade (do par ou do grupo),
 * a legenda de cores (tocar numa pessoa mostra só os itens dela) e os filtros
 * rápidos "Em comum" e "Sugestões para mim".
 */
export function MatchPanel({
  info,
  filter,
  onFilterChange,
}: {
  info: MatchCopyInfo
  filter: MatchFilter
  onFilterChange: (filter: MatchFilter) => void
}) {
  const duo = info.pairs.length === 1
  const main = duo ? info.pairs[0].percent : info.group
  const mainLabel = duo ? info.pairs[0].label : "o grupo, pela média dos pares"
  const counts: Record<MatchFilter["mode"], number | null> = {
    all: null,
    common: info.totals.common,
    suggestions: info.totals.suggestions,
  }

  return (
    <section
      aria-label="O match"
      className="mb-5 space-y-3 rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="plaque">Compatibilidade</p>
          <p className="display text-4xl leading-none text-brand">
            {main === null ? "—" : `${main}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{mainLabel}</p>
        </div>
        {info.pairs.length > 1 ? (
          <ul className="flex w-full min-w-0 flex-wrap gap-1.5" aria-label="Os pares">
            {info.pairs.map((pair) => (
              <li
                key={`${pair.a}-${pair.b}`}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                  pair.withMe ? "border-line-hi text-foreground" : "border-line text-muted-foreground"
                )}
              >
                <span className="truncate">{pair.label}</span>
                <span className="display shrink-0 text-sm text-brand">{pair.percent}%</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Quem está no match">
        {info.people.map((person) => {
          const active = filter.person === person.userId
          return (
            <li key={person.userId || "sem-conta"} className="min-w-0 max-w-full">
              <button
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onFilterChange({ ...filter, person: active ? null : person.userId })
                }
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-brand-dim bg-brand-wash text-foreground"
                    : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                <span className="truncate">{person.label}</span>
                <span className="shrink-0 text-faint">{person.items}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros rápidos">
        {MODES.map((item) => {
          const active = filter.mode === item.mode
          const count = counts[item.mode]
          return (
            <button
              key={item.mode}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange({ ...filter, mode: item.mode })}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-brand-dim bg-brand-wash text-foreground"
                  : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
              )}
            >
              {item.label}
              {count !== null ? <span className="ml-1 text-faint">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
        <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
        <span>
          Só você vê esta cópia ({itemCount(info.people.reduce((sum, p) => sum + p.items, 0))}):
          só as categorias que vocês têm em comum. É uma foto de quando o match ficou pronto: não
          atualiza. Para levar algo para o seu acervo, use{" "}
          <span className="text-muted-foreground">Trazer</span>.
        </span>
      </p>
    </section>
  )
}
