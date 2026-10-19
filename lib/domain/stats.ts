/**
 * Estatísticas da aba Números.
 *
 * Ponto central: tudo aqui é calculado sobre o RECORTE que está na tela (a
 * pasta aberta com as subpastas dela, depois do filtro), não sobre a
 * categoria inteira. Quem chama passa esse recorte.
 *
 * A ideia é ler rápido: um resumo, as notas por estrela, os destaques, uma
 * linha por campo e as tags — sem cartão que repete o que outro já diz.
 */

import { DEFAULT_CURRENCY } from "./fields"
import { formatDateBR, formatDecimal, formatMinutes, formatRating } from "./format"
import { TIERS, tierOf } from "./tiers"
import type { EntryView, Estrutura, FieldType, Tag } from "./types"

export interface RatingRow {
  /** "5", "4–4,5"… */
  label: string
  count: number
  /** Largura da barra, proporcional à maior linha. */
  percent: number
}

/** Uma linha da lista de campos: o nome, o valor em destaque e o resto. */
export interface FieldSummary {
  id: string
  label: string
  tipo: FieldType
  /** "2,3 em média", "★ 3,9", "Salão 6 · Delivery 2"… */
  headline: string
  /** "de 1 a 5", "23 no total", "em 6 de 10"… */
  details: string[]
}

export interface TagStat {
  tag: Tag
  count: number
}

export interface Stats {
  total: number
  ratedCount: number
  average: number | null
  averageLabel: string
  /** As 6 faixas de estrela, de 5 a 0–0,5 (vazias também, para comparar). */
  ratingRows: RatingRow[]
  /** Os 3 de nota mais alta (empate: pelo nome). */
  best: EntryView[]
  /** O de nota mais baixa — só quando não está entre os melhores. */
  worst: EntryView | null
  fields: FieldSummary[]
  /** As tags mais usadas no recorte, até 8. */
  topTags: TagStat[]
}

/** "4–4,5" para a faixa A, "5" para a S. */
function rowLabel(min: number): string {
  return min >= 5 ? "5" : `${formatRating(min)}–${formatRating(min + 0.5)}`
}

function formatNumber(tipo: FieldType, value: number, moeda?: string): string {
  switch (tipo) {
    case "time":
      return formatMinutes(Math.round(value)) || "0 min"
    case "star":
      return `★ ${formatRating(Math.round(value * 10) / 10)}`
    case "currency":
      return `${moeda ?? DEFAULT_CURRENCY} ${formatDecimal(value, 2)}`
    case "decimal":
      return formatDecimal(value, 2)
    default:
      return formatDecimal(value, 1)
  }
}

/** Soma faz sentido para contagem, dinheiro e tempo — não para nota nem medida. */
const SUMMABLE: FieldType[] = ["int", "currency", "time"]

function summarizeField(
  field: Estrutura[number],
  raw: (string | number)[],
  total: number
): FieldSummary | null {
  const filled = raw.length < total ? [`em ${raw.length} de ${total}`] : []

  if (field.tipo === "select") {
    const counts = new Map<string, number>()
    for (const value of raw) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1)
    const ranked = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")
    )
    const shown = ranked.slice(0, 4).map(([option, count]) => `${option} ${count}`)
    const rest = ranked.length - 4
    return {
      id: field.id,
      label: field.nome,
      tipo: field.tipo,
      headline: shown.join(" · ") + (rest > 0 ? ` · +${rest}` : ""),
      details: filled,
    }
  }

  if (field.tipo === "date") {
    const dates = raw
      .map(String)
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort()
    if (dates.length === 0) return null
    const first = formatDateBR(dates[0])
    const last = formatDateBR(dates[dates.length - 1])
    return {
      id: field.id,
      label: field.nome,
      tipo: field.tipo,
      headline: first === last ? first : `de ${first} a ${last}`,
      details: filled,
    }
  }

  if (!["int", "decimal", "currency", "time", "star"].includes(field.tipo)) return null

  const numbers = raw.map(Number).filter((value) => Number.isFinite(value))
  if (numbers.length === 0) return null
  const sum = numbers.reduce((acc, value) => acc + value, 0)
  const mean = sum / numbers.length
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const format = (value: number) => formatNumber(field.tipo, value, field.moeda)
  // Na faixa, a estrela já está no destaque: "de 3 a 5" lê melhor que "de ★ 3 a ★ 5".
  const formatEdge = field.tipo === "star" ? formatRating : format

  const details: string[] = []
  if (min !== max) details.push(`de ${formatEdge(min)} a ${formatEdge(max)}`)
  if (SUMMABLE.includes(field.tipo) && numbers.length > 1) details.push(`${format(sum)} no total`)
  details.push(...filled)

  return {
    id: field.id,
    label: field.nome,
    tipo: field.tipo,
    headline: field.tipo === "star" ? format(mean) : `${format(mean)} em média`,
    details,
  }
}

export function computeStats(views: EntryView[], estrutura: Estrutura): Stats {
  const rated = views.filter((view) => view.rating !== null)
  const sum = rated.reduce((acc, view) => acc + (view.rating ?? 0), 0)
  const average = rated.length > 0 ? sum / rated.length : null

  // ---- notas por estrela: as 6 faixas do tier list ------------------------
  const tally = new Map<string, number>()
  for (const view of rated) {
    const tier = tierOf(view.rating)
    if (tier) tally.set(tier, (tally.get(tier) ?? 0) + 1)
  }
  const biggest = Math.max(0, ...tally.values())
  const ratingRows: RatingRow[] = TIERS.map((tier) => {
    const count = tally.get(tier.id) ?? 0
    return {
      label: rowLabel(tier.min),
      count,
      percent: biggest > 0 ? (count / biggest) * 100 : 0,
    }
  })

  // ---- destaques ----------------------------------------------------------
  const byRating = [...rated].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name, "pt-BR")
  )
  const best = byRating.slice(0, 3)
  const worst = byRating.length > best.length ? byRating[byRating.length - 1] : null

  // ---- uma linha por campo, na ordem da estrutura -------------------------
  const fields: FieldSummary[] = []
  for (const field of estrutura) {
    const raw = views
      .map((view) => view.values[field.id])
      .filter((value) => value !== undefined && value !== null && value !== "")
    if (raw.length === 0) continue
    const summary = summarizeField(field, raw, views.length)
    if (summary) fields.push(summary)
  }

  // ---- tags mais usadas: até 8 -------------------------------------------
  const tagCounts = new Map<string, TagStat>()
  for (const view of views) {
    for (const tag of view.tags) {
      const current = tagCounts.get(tag.id)
      if (current) current.count += 1
      else tagCounts.set(tag.id, { tag, count: 1 })
    }
  }
  const topTags = [...tagCounts.values()]
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name, "pt-BR"))
    .slice(0, 8)

  return {
    total: views.length,
    ratedCount: rated.length,
    average,
    averageLabel: average === null ? "—" : formatDecimal(average, 1),
    ratingRows,
    best,
    worst,
    fields,
    topTags,
  }
}
