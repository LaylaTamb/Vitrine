/**
 * Estatísticas da aba Números.
 *
 * Ponto central: tudo aqui é calculado sobre a LISTA FILTRADA, não sobre a
 * categoria inteira. Quem chama passa o recorte que está na tela.
 */

import { DEFAULT_CURRENCY, isNumericField } from "./fields"
import { formatDecimal, formatMinutes, formatRating, itemCount } from "./format"
import type { EntryView, Estrutura, Tag } from "./types"

export interface FieldStat {
  id: string
  label: string
  /** Valor em destaque: a média, ou a opção mais comum. */
  value: string
  /** "média · 8 itens" ou "mais comum · 5 itens" */
  caption: string
}

export interface RatingBucket {
  /** 5, 4.5, 4 … 0.5 */
  value: number
  label: string
  count: number
  /** Largura da barra, proporcional ao maior balde. */
  percent: number
}

export interface TagStat {
  tag: Tag
  count: number
  percent: number
}

export interface Stats {
  total: number
  ratedCount: number
  average: number | null
  averageLabel: string
  fields: FieldStat[]
  distribution: RatingBucket[]
  topTags: TagStat[]
}

export function computeStats(views: EntryView[], estrutura: Estrutura): Stats {
  const rated = views.filter((view) => view.rating !== null)
  const sum = rated.reduce((acc, view) => acc + (view.rating ?? 0), 0)
  const average = rated.length > 0 ? sum / rated.length : null

  // ---- um cartão por campo, na ordem da estrutura -------------------------
  const fields: FieldStat[] = []

  for (const field of estrutura) {
    const raw = views
      .map((view) => view.values[field.id])
      .filter((value) => value !== undefined && value !== null && value !== "")

    if (raw.length === 0) continue

    if (isNumericField(field.tipo)) {
      const numbers = raw.map(Number).filter((value) => Number.isFinite(value))
      if (numbers.length === 0) continue
      const mean = numbers.reduce((acc, value) => acc + value, 0) / numbers.length
      const value =
        field.tipo === "time"
          ? formatMinutes(Math.round(mean))
          : field.tipo === "star"
            ? formatRating(Math.round(mean * 10) / 10)
            : field.tipo === "currency"
              ? `${field.moeda ?? DEFAULT_CURRENCY} ${formatDecimal(mean, 2)}`
              : field.tipo === "decimal"
                ? formatDecimal(mean, 2)
                : formatDecimal(mean, 1)
      fields.push({
        id: field.id,
        label: field.nome,
        value: value || "—",
        caption: `média · ${itemCount(numbers.length)}`,
      })
      continue
    }

    if (field.tipo === "select") {
      const counts = new Map<string, number>()
      for (const value of raw) {
        const key = String(value)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const ranked = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")
      )
      const top = ranked[0]
      if (!top) continue
      fields.push({
        id: field.id,
        label: field.nome,
        value: top[0],
        caption: `mais comum · ${itemCount(top[1])}`,
      })
    }

    // `str` e `date` não geram cartão.
  }

  // ---- distribuição das notas: 10 barras, de 5 a 0,5 ----------------------
  const buckets: RatingBucket[] = []
  const tally = new Map<number, number>()
  for (const view of rated) {
    const value = Math.round((view.rating ?? 0) * 2) / 2
    tally.set(value, (tally.get(value) ?? 0) + 1)
  }
  let biggest = 0
  for (let value = 5; value >= 0.5; value -= 0.5) {
    const count = tally.get(value) ?? 0
    if (count > biggest) biggest = count
  }
  for (let value = 5; value >= 0.5; value -= 0.5) {
    const count = tally.get(value) ?? 0
    buckets.push({
      value,
      label: formatRating(value),
      count,
      percent: biggest > 0 ? (count / biggest) * 100 : 0,
    })
  }

  // ---- tags mais usadas: até 8 -------------------------------------------
  const tagCounts = new Map<string, { tag: Tag; count: number }>()
  for (const view of views) {
    for (const tag of view.tags) {
      const current = tagCounts.get(tag.id)
      if (current) current.count += 1
      else tagCounts.set(tag.id, { tag, count: 1 })
    }
  }
  const ranked = [...tagCounts.values()].sort(
    (a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name, "pt-BR")
  )
  const topCount = ranked[0]?.count ?? 0
  const topTags: TagStat[] = ranked.slice(0, 8).map((item) => ({
    tag: item.tag,
    count: item.count,
    percent: topCount > 0 ? (item.count / topCount) * 100 : 0,
  }))

  return {
    total: views.length,
    ratedCount: rated.length,
    average,
    averageLabel: average === null ? "—" : formatDecimal(average, 1),
    fields,
    distribution: buckets,
    topTags,
  }
}
