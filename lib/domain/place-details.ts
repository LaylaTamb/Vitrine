/**
 * Os dados de um lugar salvo — vindos do OpenStreetMap, via Geoapify — já no
 * formato da tela, e as contas feitas em cima deles. Tudo puro, valendo no
 * servidor e no navegador.
 *
 * O horário vem como períodos da semana (e não como "aberto agora"): o
 * servidor guarda a resposta por até 24 h, e "aberto agora" de ontem não
 * vale hoje. Quem diz se está aberto é `openingStatus`, na hora de mostrar.
 */

import { formatMinutes } from "./format"
import type { EntryView } from "./types"

/** Um ponto da semana: `day` 0 = domingo … 6 = sábado, na hora local do lugar. */
export interface OpeningPoint {
  day: number
  hour: number
  minute: number
}

/** Um período de funcionamento. Sem `close`: aberto 24 horas. */
export interface OpeningPeriod {
  open: OpeningPoint
  close: OpeningPoint | null
}

export interface PlaceDetails {
  placeId: string
  name: string | null
  /** O que é, em português: "Restaurante · japonesa". */
  typeLabel: string | null
  /** Os períodos lidos do horário. `null` = sem horário, ou num formato que o app não lê. */
  periods: OpeningPeriod[] | null
  /** O horário como veio do OpenStreetMap — mostrado quando não dá para ler os períodos. */
  openingHoursText: string | null
  /** Fuso do lugar. Sem ele, a conta usa o de Brasília. */
  utcOffsetMinutes: number | null
  phone: string | null
  website: string | null
}

/** O trajeto de verdade (pelas ruas) até um lugar. */
export interface RouteInfo {
  distanceMeters: number
  durationSeconds: number
}

/** Brasília: o fuso de quase todo o país (sem horário de verão desde 2019). */
export const DEFAULT_UTC_OFFSET_MINUTES = -180

// ---------------------------------------------------------------------------
// o que é o lugar
// ---------------------------------------------------------------------------

/**
 * Categorias da Geoapify → nome em português. A mais específica que aparecer
 * na lista ganha ("catering.restaurant" antes de "catering").
 */
const CATEGORY_LABELS: [string, string][] = [
  ["catering.restaurant", "Restaurante"],
  ["catering.fast_food", "Lanchonete"],
  ["catering.cafe", "Café"],
  ["catering.bar", "Bar"],
  ["catering.pub", "Bar"],
  ["catering.biergarten", "Bar"],
  ["catering.ice_cream", "Sorveteria"],
  ["catering.food_court", "Praça de alimentação"],
  ["catering", "Comida e bebida"],
  ["commercial.food_and_drink.bakery", "Padaria"],
  ["commercial.supermarket", "Supermercado"],
  ["commercial.books", "Livraria"],
  ["commercial.marketplace", "Mercado"],
  ["commercial", "Loja"],
  ["entertainment.museum", "Museu"],
  ["entertainment.cinema", "Cinema"],
  ["entertainment.culture.theatre", "Teatro"],
  ["entertainment.culture.gallery", "Galeria"],
  ["entertainment.culture", "Cultura"],
  ["entertainment", "Entretenimento"],
  ["leisure.park", "Parque"],
  ["leisure", "Lazer"],
  ["national_park", "Parque nacional"],
  ["tourism.attraction", "Ponto turístico"],
  ["tourism.sights", "Ponto turístico"],
  ["tourism", "Turismo"],
  ["accommodation.hotel", "Hotel"],
  ["accommodation", "Hospedagem"],
]

const CUISINE_LABELS: Record<string, string> = {
  japanese: "japonesa",
  sushi: "sushi",
  ramen: "lámen",
  italian: "italiana",
  pizza: "pizza",
  brazilian: "brasileira",
  regional: "regional",
  chinese: "chinesa",
  korean: "coreana",
  thai: "tailandesa",
  indian: "indiana",
  mexican: "mexicana",
  peruvian: "peruana",
  arab: "árabe",
  lebanese: "libanesa",
  french: "francesa",
  portuguese: "portuguesa",
  spanish: "espanhola",
  german: "alemã",
  burger: "hambúrguer",
  barbecue: "churrasco",
  steak_house: "churrascaria",
  seafood: "frutos do mar",
  fish: "peixes",
  vegetarian: "vegetariana",
  vegan: "vegana",
  coffee_shop: "café",
  ice_cream: "sorvete",
  sandwich: "sanduíche",
  breakfast: "café da manhã",
  international: "internacional",
}

/** `["catering", "catering.restaurant"]` + `"japanese;sushi"` → "Restaurante · japonesa, sushi". */
export function typeLabelOf(categories: string[], cuisine?: string | null): string | null {
  const base =
    CATEGORY_LABELS.find(([prefix]) =>
      categories.some((category) => category === prefix || category.startsWith(`${prefix}.`))
    )?.[1] ?? null
  const cuisines = (cuisine ?? "")
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => CUISINE_LABELS[item] ?? item.replace(/_/g, " "))
  const unique = [...new Set(cuisines)]
  if (!base && unique.length === 0) return null
  if (!base) return unique.join(", ")
  return unique.length > 0 ? `${base} · ${unique.join(", ")}` : base
}

// ---------------------------------------------------------------------------
// horário
// ---------------------------------------------------------------------------

const DAY = 24 * 60
const WEEK = 7 * DAY
const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

function minuteOfWeek(point: OpeningPoint): number {
  return point.day * DAY + point.hour * 60 + point.minute
}

function clock(minutes: number): string {
  const inDay = ((minutes % DAY) + DAY) % DAY
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`
}

export interface OpeningStatus {
  open: boolean
  /** "Aberto agora · fecha às 23:00", "Fechado hoje · abre amanhã às 11:00"… */
  label: string
}

/**
 * Aberto agora? Calculado na hora local do lugar (`utcOffsetMinutes`), a
 * partir dos períodos da semana. Sem horário: `null`.
 */
export function openingStatus(
  periods: OpeningPeriod[] | null,
  utcOffsetMinutes: number | null,
  now: number
): OpeningStatus | null {
  if (!periods || periods.length === 0) return null
  if (periods.some((period) => period.close === null)) return { open: true, label: "Aberto 24 horas" }

  const offset = utcOffsetMinutes ?? DEFAULT_UTC_OFFSET_MINUTES
  const local = new Date(now + offset * 60_000)
  const today = local.getUTCDay()
  const current = today * DAY + local.getUTCHours() * 60 + local.getUTCMinutes()

  for (const period of periods) {
    const start = minuteOfWeek(period.open)
    let end = minuteOfWeek(period.close!)
    if (end <= start) end += WEEK // vira a semana (sábado → domingo)
    const inside =
      (current >= start && current < end) || (current + WEEK >= start && current + WEEK < end)
    if (!inside) continue
    // Um período que fecha na hora em que outro abre ("Mo-Su 00:00-24:00") é um só.
    let close = end
    for (let step = 0; step < periods.length; step++) {
      const next = periods.find((other) => minuteOfWeek(other.open) === close % WEEK)
      if (!next) break
      const nextStart = minuteOfWeek(next.open)
      let nextEnd = minuteOfWeek(next.close!)
      if (nextEnd <= nextStart) nextEnd += WEEK
      close += nextEnd - nextStart
      if (close - start >= WEEK) return { open: true, label: "Aberto 24 horas" }
    }
    return { open: true, label: `Aberto agora · fecha às ${clock(close)}` }
  }

  // Fechado: quando abre de novo?
  const wait = Math.min(
    ...periods.map((period) => (minuteOfWeek(period.open) - current + WEEK) % WEEK)
  )
  const next = current + wait
  const leftToday = DAY - (current % DAY)
  if (wait < leftToday) return { open: false, label: `Fechado agora · abre às ${clock(next)}` }

  const opensToday = periods.some((period) => period.open.day === today)
  const when = wait < leftToday + DAY ? "amanhã" : DAY_NAMES[Math.floor((next % WEEK) / DAY)]
  return {
    open: false,
    label: `${opensToday ? "Fechado agora" : "Fechado hoje"} · abre ${when} às ${clock(next)}`,
  }
}

// ---------------------------------------------------------------------------
// trajeto, preço e ordem
// ---------------------------------------------------------------------------

/** Tempo de trajeto: `95 → "2 min"`, `5400 → "1h 30min"`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ""
  return formatMinutes(Math.max(1, Math.round(seconds / 60)))
}

/** O que eu anotei de preço: o primeiro campo Moeda preenchido do item ("R$ 45,00"). */
export function myPriceOf(view: Pick<EntryView, "extras">): string | null {
  return view.extras.find((extra) => extra.tipo === "currency")?.value ?? null
}

/** Os raios da busca, em metros. O padrão é 2 km. */
export const SUGGESTION_RADII = [500, 1000, 2000, 5000, 10_000, 25_000]
export const DEFAULT_RADIUS = 2000

/** O menor raio da lista que alcança `distance` — para sugerir "aumente o raio". */
export function radiusThatReaches(distance: number): number | null {
  return SUGGESTION_RADII.find((radius) => radius >= distance) ?? null
}

export type SuggestionSort = "distance" | "mine"

export const SUGGESTION_SORTS: { value: SuggestionSort; label: string }[] = [
  { value: "distance", label: "Distância" },
  { value: "mine", label: "Minha nota" },
]

/**
 * Ordena as sugestões. Distância é o padrão; por nota, quem não tem nota vai
 * para o fim, e o empate desempata pela distância.
 */
export function sortSuggestions<T extends { distance: number; myRating: number | null }>(
  items: T[],
  sort: SuggestionSort
): T[] {
  const byDistance = (a: T, b: T) => a.distance - b.distance
  if (sort === "distance") return [...items].sort(byDistance)
  return [...items].sort((a, b) => {
    if (a.myRating === null && b.myRating === null) return byDistance(a, b)
    if (a.myRating === null) return 1
    if (b.myRating === null) return -1
    return b.myRating - a.myRating || byDistance(a, b)
  })
}
