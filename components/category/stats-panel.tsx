"use client"

import Link from "next/link"
import { BarChart3 } from "lucide-react"
import type { ReactNode } from "react"

import { EntryImage } from "@/components/entry/entry-image"
import { EmptyState } from "@/components/layout/empty-state"
import { computeStats } from "@/lib/domain/stats"
import { formatRating, itemCount, plural } from "@/lib/domain/format"
import type { EntryView, Estrutura } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * A aba Números: um resumo, as notas por estrela, os destaques, uma linha
 * por campo e as tags.
 *
 * Tudo é calculado sobre o recorte da tela — a pasta aberta com as
 * subpastas dela, depois do filtro. Por isso o aviso quando há filtro ativo.
 */
export function StatsPanel({
  views,
  estrutura,
  filterActive,
  ratingEnabled = true,
  includesSubfolders = false,
  categoryColor,
}: {
  views: EntryView[]
  estrutura: Estrutura
  filterActive: boolean
  /** Categoria sem estrelas: nada de nota média, faixas nem destaques. */
  ratingEnabled?: boolean
  /** O recorte junta itens de subpastas — vale dizer, para o total bater com o que se vê. */
  includesSubfolders?: boolean
  categoryColor?: string | null
}) {
  const stats = computeStats(views, estrutura)

  if (stats.total === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nada para contar"
        description="Nenhum item no recorte atual — ajuste o filtro para ver os números."
      />
    )
  }

  const showRatings = ratingEnabled && stats.ratedCount > 0
  const scope = [
    includesSubfolders ? "inclui as subpastas" : "",
    filterActive ? "só o que passa pelo filtro" : "",
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      {/* ---- resumo ---------------------------------------------------- */}
      <section
        aria-label="Resumo"
        className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-line bg-surface px-4 py-3.5"
      >
        <Figure value={String(stats.total)} label={stats.total === 1 ? "item" : "itens"} />
        {ratingEnabled ? (
          <>
            <Figure value={`★ ${stats.averageLabel}`} label="de média" />
            <p className="pb-0.5 text-sm text-muted-foreground">
              {plural(stats.ratedCount, "com nota", "com nota")}
              {stats.total > stats.ratedCount
                ? ` · ${plural(stats.total - stats.ratedCount, "sem nota", "sem nota")}`
                : ""}
            </p>
          </>
        ) : null}
        {scope.length > 0 ? (
          <p className="w-full text-xs text-faint sm:ml-auto sm:w-auto sm:pb-0.5">
            {scope.join(" · ")}
          </p>
        ) : null}
      </section>

      {/* ---- notas e destaques ----------------------------------------- */}
      {showRatings ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Notas">
            <ul className="space-y-1.5">
              {stats.ratingRows.map((row) => (
                <li key={row.label} className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg-soft">
                    <span
                      className="block h-full rounded-full bg-brand transition-[width]"
                      style={{ width: `${row.percent}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-6 shrink-0 text-right tabular-nums",
                      row.count > 0 ? "text-muted-foreground" : "text-faint"
                    )}
                  >
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Destaques">
            <ul className="space-y-1">
              {stats.best.map((view) => (
                <HighlightRow key={view.id} view={view} categoryColor={categoryColor} />
              ))}
            </ul>
            {stats.worst ? (
              <>
                <p className="plaque mb-1 mt-3">Menor nota</p>
                <ul>
                  <HighlightRow view={stats.worst} categoryColor={categoryColor} />
                </ul>
              </>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {/* ---- campos ---------------------------------------------------- */}
      {stats.fields.length > 0 ? (
        <Panel title="Campos">
          <dl className="divide-y divide-line">
            {stats.fields.map((field) => (
              <div
                key={field.id}
                className="grid gap-x-4 gap-y-0.5 py-2 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
              >
                <dt className="truncate text-sm text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 text-sm">
                  <span className="text-foreground">{field.headline}</span>
                  {field.details.length > 0 ? (
                    <span className="text-faint"> · {field.details.join(" · ")}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      {/* ---- tags ------------------------------------------------------ */}
      {stats.topTags.length > 0 ? (
        <Panel title="Tags mais usadas">
          <ul className="flex flex-wrap gap-1.5">
            {stats.topTags.map((item) => (
              <li
                key={item.tag.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs"
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.tag.color }}
                />
                <span className="text-muted-foreground">{item.tag.name}</span>
                <span className="tabular-nums text-faint" aria-label={itemCount(item.count)}>
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="display text-3xl leading-none">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </p>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="plaque mb-3">{title}</h3>
      {children}
    </section>
  )
}

function HighlightRow({
  view,
  categoryColor,
}: {
  view: EntryView
  categoryColor?: string | null
}) {
  return (
    <li>
      <Link
        href={view.href}
        className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-hi"
      >
        <EntryImage
          imageUrl={view.imageUrl}
          imageTransform={view.imageTransform}
          initial={view.initial}
          ratio="1 / 1"
          initialSize="0.85rem"
          className="w-8 shrink-0"
          tint={categoryColor}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{view.name}</span>
        <span className="shrink-0 text-sm tabular-nums text-brand">
          ★ {formatRating(view.rating)}
        </span>
      </Link>
    </li>
  )
}
