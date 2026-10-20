/**
 * "Você está em X?" (Etapa 4.4): os lugares a até ~150 m de quem abre
 * Coleções ou o Mapa — só se a localização JÁ foi autorizada antes (o app
 * nunca pede sem um toque). O cartão do lugar mostra o que é, o horário e,
 * "No Vitrine", quem avaliou (migração 28); "Adicionar" salva com o Nome e a
 * Localização já prontos, sem gastar busca de endereço.
 */

import { isInbox } from "./inbox"
import { locationFieldsOf } from "./fields"
import type { LatLng } from "./map"
import type { OpeningPeriod } from "./place-details"
import type { Category } from "./types"

/** O raio da busca: o quarteirão onde a pessoa está. */
export const NEARBY_RADIUS_METERS = 150

/** Quantos lugares a faixa mostra. */
export const NEARBY_SHOWN = 3

/** Os tipos de lugar que fazem sentido "estar em" (categorias da Geoapify). */
export const NEARBY_CATEGORIES = [
  "catering",
  "commercial",
  "entertainment",
  "leisure",
  "tourism",
  "accommodation",
  "sport",
  "activity",
  "heritage",
].join(",")

export interface NearbyPlace {
  /** O id da Geoapify — também a chave do lugar no catálogo comum. */
  placeId: string
  name: string
  lat: number
  lng: number
  typeLabel: string | null
  address: string | null
  /** "node/123" — a outra chave do catálogo. */
  osmId: string | null
  periods: OpeningPeriod[] | null
  openingHoursText: string | null
  utcOffsetMinutes: number | null
}

export function isValidPoint(point: LatLng | null | undefined): point is LatLng {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lng) <= 180
  )
}

/**
 * O centro da busca, arredondado numa grade de ~55 m: quem está no mesmo
 * quarteirão reaproveita a mesma resposta (o cache do servidor e o da aba).
 */
export function nearbyCacheCenter(point: LatLng): LatLng {
  const snap = (value: number) => Math.round(value * 2000) / 2000
  return { lat: snap(point.lat), lng: snap(point.lng) }
}

/** "aqui", "a 40 m", "a 1,2 km". */
export function distanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 20) return "aqui"
  if (meters < 1000) return `a ${Math.round(meters / 10) * 10} m`
  return `a ${(meters / 1000).toFixed(1).replace(".", ",")} km`
}

/** O texto que vai no campo Localização do item novo. */
export function placeAddressText(place: Pick<NearbyPlace, "name" | "address">): string {
  return (place.address || place.name).slice(0, 300)
}

// ---------------------------------------------------------------------------
// "No Vitrine" (migração 28)
// ---------------------------------------------------------------------------

export interface PlaceRatings {
  count: number
  average: number | null
  ratings: { username: string; rating: number; isMe: boolean }[]
  /** Onde o lugar já está no seu acervo. */
  mine: { entryId: string; categoryId: string; categoryName: string }[]
}

export const EMPTY_RATINGS: PlaceRatings = { count: 0, average: null, ratings: [], mine: [] }

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** O que `place_ratings` devolve, conferido campo a campo. */
export function parsePlaceRatings(raw: unknown): PlaceRatings {
  if (!raw || typeof raw !== "object") return EMPTY_RATINGS
  const row = raw as Record<string, unknown>
  const ratings = (Array.isArray(row.ratings) ? row.ratings : []).flatMap((item) => {
    const value = item as { username?: unknown; rating?: unknown; is_me?: unknown } | null
    const username = text(value?.username)
    const rating = typeof value?.rating === "number" ? value.rating : Number(value?.rating)
    if (!username || !Number.isFinite(rating) || rating <= 0) return []
    return [{ username, rating, isMe: value?.is_me === true }]
  })
  const mine = (Array.isArray(row.mine) ? row.mine : []).flatMap((item) => {
    const value = item as Record<string, unknown> | null
    const entryId = text(value?.entry_id)
    const categoryId = text(value?.category_id)
    const categoryName = text(value?.category_name)
    return entryId && categoryId && categoryName ? [{ entryId, categoryId, categoryName }] : []
  })
  const average = Number(row.average)
  return {
    count: typeof row.count === "number" && row.count > 0 ? Math.trunc(row.count) : ratings.length,
    average: row.average !== null && Number.isFinite(average) && average > 0 ? average : null,
    ratings,
    mine,
  }
}

// ---------------------------------------------------------------------------
// Para onde vai o lugar
// ---------------------------------------------------------------------------

export interface PlaceTarget {
  id: string
  name: string
  icon: string | null
  /** Tem campo Localização: o lugar entra com o endereço e aparece no Mapa. */
  hasLocation: boolean
  inbox: boolean
  ratingEnabled: boolean
}

/**
 * As categorias para "Adicionar": as que têm Localização primeiro (na ordem
 * da pessoa), depois a "A organizar", depois as outras (só com o nome).
 */
export function placeTargets(
  categories: Pick<
    Category,
    "id" | "name" | "icon" | "estrutura" | "kind" | "rating_enabled" | "display_order"
  >[]
): PlaceTarget[] {
  const rank = (target: PlaceTarget) => (target.inbox ? 1 : target.hasLocation ? 0 : 2)
  return categories
    .slice()
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"))
    .map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      hasLocation: locationFieldsOf(category.estrutura).length > 0,
      inbox: isInbox(category),
      ratingEnabled: category.rating_enabled,
    }))
    .sort((a, b) => rank(a) - rank(b))
}
