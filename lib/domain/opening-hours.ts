/**
 * O horário de funcionamento no formato do OpenStreetMap (`opening_hours`),
 * virando períodos da semana: "Mo-Fr 12:00-15:00,19:00-23:30; Su off".
 *
 * Lê os casos comuns — dias e faixas de dias, várias faixas de horário,
 * madrugada (18:00-02:00), `off`/`closed`, `24/7` — com a regra do OSM de
 * que uma regra posterior substitui as anteriores nos dias que ela cita.
 * Regras de feriado (`PH`) e férias escolares (`SH`) são ignoradas. Qualquer
 * coisa fora disso (meses, datas, nascer do sol, comentários…) devolve
 * `null`: a tela mostra o texto, sem inventar um "aberto agora".
 */

import type { OpeningPeriod } from "./place-details"

/** Dias do OSM → 0 = domingo … 6 = sábado (a convenção de `OpeningPoint`). */
const DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 }
const ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const DAY = 24 * 60

function parseDays(selector: string): number[] | null {
  const days = new Set<number>()
  for (const part of selector.split(",")) {
    const range = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim())
    if (!range) return null
    const from = ORDER.indexOf(range[1])
    const to = range[2] ? ORDER.indexOf(range[2]) : from
    // "Fr-Mo" atravessa o fim de semana.
    for (let index = from; ; index = (index + 1) % 7) {
      days.add(DAYS[ORDER[index]])
      if (index === to) break
    }
  }
  return [...days]
}

function minutesOf(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 48 || minutes > 59) return null
  return hours * 60 + minutes
}

/** "12:00-15:00,19:00-23:30" → [[720, 900], [1140, 1410]]. Madrugada: o fim passa de 24h. */
function parseTimes(selector: string): [number, number][] | null {
  const out: [number, number][] = []
  for (const part of selector.split(",")) {
    const [from, to] = part.trim().split("-")
    const start = from ? minutesOf(from) : null
    let end = to ? minutesOf(to) : null
    if (start === null || end === null || start >= DAY) return null
    if (end <= start) end += DAY
    out.push([start, end])
  }
  return out
}

export function parseOpeningHours(raw: string | null | undefined): OpeningPeriod[] | null {
  const text = raw?.trim()
  if (!text) return null
  if (text === "24/7") return [{ open: { day: 0, hour: 0, minute: 0 }, close: null }]

  // dia (0–6) → faixas em minutos a partir da meia-noite daquele dia
  const week = new Map<number, [number, number][]>()

  for (const rule of text.split(";")) {
    const trimmed = rule.trim()
    if (!trimmed) continue
    if (/^(PH|SH)\b/.test(trimmed)) continue // feriado / férias: fora do escopo

    const match = /^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(.+)$/.exec(
      trimmed
    )
    if (!match) return null
    const days = match[1] ? parseDays(match[1]) : [0, 1, 2, 3, 4, 5, 6]
    if (!days) return null

    const rest = match[2].trim()
    if (rest === "off" || rest === "closed") {
      for (const day of days) week.set(day, [])
      continue
    }
    if (rest === "24/7" || rest === "00:00-24:00") {
      for (const day of days) week.set(day, [[0, DAY]])
      continue
    }
    const times = parseTimes(rest)
    if (!times) return null
    for (const day of days) week.set(day, times)
  }

  const periods: OpeningPeriod[] = []
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    for (const [start, end] of week.get(day) ?? []) {
      const closeAt = day * DAY + end
      periods.push({
        open: { day, hour: Math.floor(start / 60), minute: start % 60 },
        close: {
          day: Math.floor(closeAt / DAY) % 7,
          hour: Math.floor((closeAt % DAY) / 60),
          minute: closeAt % 60,
        },
      })
    }
  }
  return periods.length > 0 ? periods : null
}

const DAY_LABELS: Record<string, string> = {
  Mo: "seg",
  Tu: "ter",
  We: "qua",
  Th: "qui",
  Fr: "sex",
  Sa: "sáb",
  Su: "dom",
  PH: "feriados",
}

/** O texto do OSM legível em português, para quando não dá para ler os períodos. */
export function humanizeOpeningHours(raw: string): string {
  return raw
    .trim()
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (token) => DAY_LABELS[token] ?? token)
    .replace(/\b(off|closed)\b/g, "fechado")
    .replace(/\bsunrise\b/g, "nascer do sol")
    .replace(/\bsunset\b/g, "pôr do sol")
    .replace(/\s*;\s*/g, " · ")
}
