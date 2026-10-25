"use client"

import { Lock } from "lucide-react"

import { itemCount, plural } from "@/lib/domain/format"
import type { MatchCopyInfo, MatchFilter } from "@/lib/domain/match"
import { cn } from "@/lib/utils"

/**
 * O topo da cópia de um match: a % de compatibilidade grande, num anel (do par
 * ou do grupo), a legenda de cores (tocar numa pessoa mostra só os itens dela)
 * e as abas Todos · Para você · Em comum · Para os outros.
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
  // Com 2 pessoas, a aba dos outros leva o @ de quem é.
  const others = info.people.filter((person) => !person.isMe)
  const theirsLabel = others.length === 1 ? `Para ${others[0].label}` : "Para os outros"
  const tabs: { mode: MatchFilter["mode"]; label: string; count: number | null }[] = [
    { mode: "all", label: "Todos", count: null },
    { mode: "suggestions", label: "Para você", count: info.totals.suggestions },
    { mode: "common", label: "Em comum", count: info.totals.common },
    { mode: "theirs", label: theirsLabel, count: info.totals.theirs },
  ]

  return (
    <section
      aria-label="O match"
      className="mb-5 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        {/* O anel: a parte colorida é a %. */}
        <div
          aria-hidden
          className="flex size-28 shrink-0 items-center justify-center rounded-full"
          style={{
            background:
              main === null
                ? "var(--color-line)"
                : `conic-gradient(var(--color-brand) ${main}%, var(--color-line) 0)`,
          }}
        >
          <div className="flex size-[94px] flex-col items-center justify-center rounded-full bg-surface">
            <span className="display text-3xl leading-none">
              {main === null ? "—" : `${main}%`}
            </span>
            <span className="mt-0.5 text-[0.65rem] text-muted-foreground">compatíveis</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="plaque">
              <span className="sr-only">{main === null ? "" : `${main}% de `}</span>
              Compatibilidade · {mainLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {plural(info.totals.common, "item em comum", "itens em comum")} ·{" "}
              {plural(info.totals.suggestions, "sugestão para você", "sugestões para você")}
            </p>
          </div>

          {info.pairs.length > 1 ? (
            <ul
              className="flex flex-wrap justify-center gap-1.5 sm:justify-start"
              aria-label="Os pares"
            >
              {info.pairs.map((pair) => (
                <li
                  key={`${pair.a}-${pair.b}`}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                    pair.withMe
                      ? "border-line-hi text-foreground"
                      : "border-line text-muted-foreground"
                  )}
                >
                  <span className="truncate">{pair.label}</span>
                  <span className="display shrink-0 text-sm text-brand">{pair.percent}%</span>
                </li>
              ))}
            </ul>
          ) : null}

          <ul
            className="flex flex-wrap justify-center gap-1.5 sm:justify-start"
            aria-label="Quem está no match"
          >
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
        </div>
      </div>

      <div
        role="group"
        aria-label="O que mostrar"
        className="flex gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const active = filter.mode === tab.mode
          return (
            <button
              key={tab.mode}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange({ ...filter, mode: tab.mode })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-brand-dim bg-brand-wash text-foreground"
                  : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== null ? <span className="ml-1.5 text-faint">{tab.count}</span> : null}
            </button>
          )
        })}
      </div>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-faint">
        <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
        <span>
          Só você vê esta cópia ({itemCount(info.people.reduce((sum, p) => sum + p.items, 0))}): só
          as categorias que vocês têm em comum. É uma foto de quando o match ficou pronto: não
          atualiza. Para levar algo para o seu acervo, use{" "}
          <span className="text-muted-foreground">Trazer</span>.
        </span>
      </p>
    </section>
  )
}
