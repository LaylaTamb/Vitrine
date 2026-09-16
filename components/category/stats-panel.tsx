"use client"

import { BarChart3 } from "lucide-react"

import { EmptyState } from "@/components/layout/empty-state"
import { Stars } from "@/components/entry/stars"
import { computeStats } from "@/lib/domain/stats"
import { itemCount } from "@/lib/domain/format"
import type { EntryView, Estrutura } from "@/lib/domain/types"

/**
 * A aba Números.
 *
 * As estatísticas são calculadas sobre a LISTA FILTRADA, não sobre a categoria
 * inteira — por isso o aviso quando há filtro ativo.
 */
export function StatsPanel({
  views,
  estrutura,
  filterActive,
}: {
  views: EntryView[]
  estrutura: Estrutura
  filterActive: boolean
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

  return (
    <div className="space-y-6">
      {filterActive ? (
        <p className="rounded-lg border border-brand-dim/40 bg-brand-wash px-3 py-2 text-xs text-muted-foreground">
          Os números abaixo consideram só os itens que passam pelo filtro ativo.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <BigNumber value={String(stats.total)} label="itens no recorte" />
        <BigNumber value={stats.averageLabel} label="nota média" />
        <BigNumber value={String(stats.ratedCount)} label="itens avaliados" />
      </div>

      {stats.fields.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.fields.map((field) => (
            <div key={field.id} className="rounded-lg border border-line bg-surface p-4">
              <p className="plaque truncate">{field.label}</p>
              <p className="display mt-1 truncate text-2xl">{field.value}</p>
              <p className="mt-0.5 text-xs text-faint">{field.caption}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-4">
          <h3 className="plaque mb-3">Distribuição das notas</h3>
          <ul className="space-y-1.5">
            {stats.distribution.map((bucket) => (
              <li key={bucket.value} className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-right text-xs text-muted-foreground">
                  {bucket.label}
                </span>
                <Stars percent={bucket.value * 20} size="sm" className="hidden shrink-0 sm:block" />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg-soft">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${bucket.percent}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-xs text-faint">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <h3 className="plaque mb-3">Tags mais usadas</h3>
          {stats.topTags.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma tag nos itens deste recorte.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.topTags.map((item) => (
                <li key={item.tag.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.tag.color }}
                      />
                      <span className="truncate text-muted-foreground">{item.tag.name}</span>
                    </span>
                    <span className="shrink-0 text-faint">{itemCount(item.count)}</span>
                  </div>
                  <span className="block h-2 overflow-hidden rounded-full bg-bg-soft">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${item.percent}%`, backgroundColor: item.tag.color }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="display text-4xl leading-none">{value}</p>
      <p className="plaque mt-2">{label}</p>
    </div>
  )
}
