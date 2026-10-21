/**
 * Links para o app/site do Google Maps — as "Maps URLs" oficiais: só links,
 * sem API, sem chave e sem custo. Funcionam até sem localização (sem login,
 * ou quando o endereço não foi encontrado): aí vai o texto do endereço.
 *
 * Prioridade do destino: coordenadas, depois o texto. (O `place_id` guardado
 * é da Geoapify, não do Google — não serve para estes links.)
 */

import type { LatLng } from "./map"
import type { EntryPlace } from "./types"

export type { LatLng }

export interface MapsTarget {
  address: string
  lat?: number | null
  lng?: number | null
}

/** Os modos de trajeto que o Vitrine oferece (a pé é o padrão). */
export type TravelMode = "walking" | "driving"

function query(params: [string, string | null | undefined][]): string {
  return params
    .filter((pair): pair is [string, string] => Boolean(pair[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&")
}

function coordsOf(target: { lat?: number | null; lng?: number | null }): string | null {
  return Number.isFinite(target.lat) && Number.isFinite(target.lng)
    ? `${target.lat},${target.lng}`
    : null
}

/** "Abrir no Maps": o lugar no Google Maps. */
export function mapsPlaceUrl(target: MapsTarget): string {
  return `https://www.google.com/maps/search/?${query([
    ["api", "1"],
    ["query", coordsOf(target) ?? target.address],
  ])}`
}

/** "Como chegar": a rota até o lugar, saindo de `origin` (ou de onde o Maps achar que estou). */
export function mapsDirectionsUrl({
  destination,
  origin,
  travelMode,
}: {
  destination: MapsTarget
  origin?: LatLng | string | null
  travelMode?: TravelMode
}): string {
  const from = typeof origin === "string" ? origin.trim() : origin ? coordsOf(origin) : null
  return `https://www.google.com/maps/dir/?${query([
    ["api", "1"],
    ["origin", from],
    ["destination", coordsOf(destination) ?? destination.address],
    ["travelmode", travelMode],
  ])}`
}

/**
 * O que o cache de `entry_places` pode dar a um link: as coordenadas, se
 * valem para o endereço de agora. Sem elas, fica o texto.
 */
export function mapsTargetOf(address: string, place: EntryPlace | undefined): MapsTarget {
  if (!place || place.status !== "ok" || place.address !== address) return { address }
  return { address, lat: place.lat, lng: place.lng }
}
