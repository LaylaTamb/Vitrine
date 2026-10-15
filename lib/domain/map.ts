/**
 * O Mapa: que itens viram pino, quais têm endereço mas ficaram de fora, e a
 * distância até cada um — tudo na memória do cliente, sem pedir nada ao
 * servidor.
 */

import { locationFieldsOf } from "./fields"
import { addressOf, isPlaceUsable, placeKey, placesByKey } from "./places"
import type { Category, EntryPlace, EntryView } from "./types"

export interface LatLng {
  lat: number
  lng: number
}

/** Um pino: um campo de Localização localizado de um item. */
export interface MapPin {
  /** `entryId|fieldId` — um item pode ter mais de um pino. */
  key: string
  entryId: string
  fieldId: string
  /** O nome do campo ("Localização", "Filial"…). */
  fieldLabel: string
  lat: number
  lng: number
  /** O texto que eu escrevi. */
  address: string
  /** O endereço como a Geoapify devolveu. */
  formattedAddress: string | null
  placeId: string | null
  view: EntryView
  category: Category
}

/** Por que um endereço não virou pino. */
export type UnplacedReason = "pending" | "not_found" | "error"

export const UNPLACED_REASON_LABELS: Record<UnplacedReason, string> = {
  pending: "ainda não procurado",
  not_found: "endereço não encontrado",
  error: "erro ao procurar",
}

export interface UnplacedAddress {
  key: string
  entryId: string
  fieldId: string
  fieldLabel: string
  address: string
  reason: UnplacedReason
  view: EntryView
  category: Category
}

interface Located {
  key: string
  fieldId: string
  fieldLabel: string
  address: string
  place: EntryPlace | undefined
  view: EntryView
  category: Category
}

/** Cada campo de Localização preenchido de cada item, com a linha de `entry_places` dele. */
function locatedAddresses(
  views: EntryView[],
  categories: Category[],
  places: EntryPlace[]
): Located[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const byKey = placesByKey(places)
  const out: Located[] = []

  for (const view of views) {
    const category = categoryById.get(view.categoryId)
    if (!category) continue
    for (const field of locationFieldsOf(category.estrutura)) {
      const address = addressOf(view.values[field.id])
      if (!address) continue
      const key = placeKey(view.id, field.id)
      out.push({
        key,
        fieldId: field.id,
        fieldLabel: field.nome,
        address,
        place: byKey.get(key),
        view,
        category,
      })
    }
  }

  return out
}

/**
 * Os pinos, na ordem dos itens recebidos (a do filtro). Só vira pino o
 * endereço localizado (`ok`) e com o texto de agora.
 */
export function buildPins(
  views: EntryView[],
  categories: Category[],
  places: EntryPlace[]
): MapPin[] {
  const pins: MapPin[] = []
  for (const item of locatedAddresses(views, categories, places)) {
    const place = item.place
    if (!isPlaceUsable(place, item.address)) continue
    pins.push({
      key: item.key,
      entryId: item.view.id,
      fieldId: item.fieldId,
      fieldLabel: item.fieldLabel,
      lat: place.lat,
      lng: place.lng,
      address: item.address,
      formattedAddress: place.formatted_address,
      placeId: place.place_id,
      view: item.view,
      category: item.category,
    })
  }
  return pins
}

/** Os endereços que não viraram pino, com o motivo. */
export function pendingPlaces(
  views: EntryView[],
  categories: Category[],
  places: EntryPlace[]
): UnplacedAddress[] {
  const out: UnplacedAddress[] = []
  for (const item of locatedAddresses(views, categories, places)) {
    const place = item.place
    if (isPlaceUsable(place, item.address)) continue

    let reason: UnplacedReason = "pending"
    if (place && place.address === item.address) {
      if (place.status === "not_found") reason = "not_found"
      else if (place.status === "error") reason = "error"
    }

    out.push({
      key: item.key,
      entryId: item.view.id,
      fieldId: item.fieldId,
      fieldLabel: item.fieldLabel,
      address: item.address,
      reason,
      view: item.view,
      category: item.category,
    })
  }
  return out
}

/** Alguma categoria tem campo de Localização? Sem nenhum, o Mapa explica como criar. */
export function hasLocationFields(categories: Category[]): boolean {
  return categories.some((category) => locationFieldsOf(category.estrutura).length > 0)
}

/**
 * A frase para cada falha do `navigator.geolocation` (o `code` do
 * `GeolocationPositionError`: 1 permissão, 2 indisponível, 3 tempo).
 */
export function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Você não deixou o navegador usar sua localização. Libere nas permissões do site e tente de novo."
    case 3:
      return "Demorou demais para achar sua localização. Tente de novo — ao ar livre costuma ser mais rápido."
    case 2:
    default:
      return "Não deu para descobrir onde você está agora. Confira se a localização do aparelho está ligada."
  }
}

const EARTH_RADIUS_M = 6_371_000

/** Distância em linha reta entre dois pontos, em metros (fórmula de haversine). */
export function haversine(a: LatLng, b: LatLng): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface NearbyPin {
  pin: MapPin
  /** Em linha reta, em metros. */
  distance: number
}

/**
 * Os pinos até `radius` metros de `origin`, do mais perto ao mais longe
 * (empate: pelo nome). Sem `radius`, todos.
 */
export function nearby(pins: MapPin[], origin: LatLng, radius = Infinity): NearbyPin[] {
  return pins
    .map((pin) => ({ pin, distance: haversine(origin, pin) }))
    .filter((item) => item.distance <= radius)
    .sort(
      (a, b) => a.distance - b.distance || a.pin.view.name.localeCompare(b.pin.view.name, "pt-BR")
    )
}
