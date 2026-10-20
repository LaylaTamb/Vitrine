import "server-only"

import { unstable_cache } from "next/cache"

import type { LatLng } from "@/lib/domain/map"
import {
  NEARBY_CATEGORIES,
  NEARBY_RADIUS_METERS,
  nearbyCacheCenter,
  type NearbyPlace,
} from "@/lib/domain/nearby"
import type { TravelMode } from "@/lib/domain/maps-links"
import type { PlaceDetails, RouteInfo } from "@/lib/domain/place-details"

import {
  geoHttpErrorReason,
  parseGeocodeResponse,
  parseNearbyPlaces,
  parsePlaceDetails,
  parseRouteMatrix,
  type GeoErrorReason,
  type GeocodeOutcome,
} from "./parse"

/**
 * As chamadas à Geoapify (dados do OpenStreetMap). Só servidor: a chave
 * `GEOAPIFY_API_KEY` nunca vai para o navegador — o mapa em si vem do
 * OpenFreeMap, que não tem chave.
 *
 * Plano grátis: 3.000 créditos por dia, sem cartão, até 5 pedidos por
 * segundo. Endereço = 1 crédito, dados de um lugar = 1, trajeto de 1 origem
 * até 10 destinos = 10. Passou do limite, a Geoapify recusa — não cobra.
 */

const GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
const DETAILS_URL = "https://api.geoapify.com/v2/place-details"
const ROUTE_MATRIX_URL = "https://api.geoapify.com/v1/routematrix"
const PLACES_URL = "https://api.geoapify.com/v2/places"
const TIMEOUT_MS = 8000

/** Cache curto no servidor: abrir as Sugestões de novo no mesmo dia não gasta crédito. */
const DETAILS_CACHE_SECONDS = 24 * 60 * 60
const ROUTES_CACHE_SECONDS = 15 * 60
const NEARBY_CACHE_SECONDS = 24 * 60 * 60

/** A chave do servidor, ou `null` quando o mapa não foi configurado. */
export function serverKey(): string | null {
  return process.env.GEOAPIFY_API_KEY?.trim() || null
}

/**
 * No máximo 5 pedidos por segundo (o limite do plano grátis): cada pedido
 * espera a sua vez, 200 ms depois do anterior. Vale para esta instância do
 * servidor.
 */
const MIN_GAP_MS = 200
let nextSlot = 0

async function takeSlot(): Promise<void> {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + MIN_GAP_MS
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
}

/**
 * Falha lançada DENTRO do cache: `unstable_cache` não guarda exceção — só
 * resposta boa fica guardada; cota estourada ou rede caída é tentada de novo
 * na próxima vez.
 */
class GeoRequestError extends Error {
  constructor(readonly reason: GeoErrorReason) {
    super(reason)
  }
}

function reasonOf(error: unknown): GeoErrorReason {
  return error instanceof GeoRequestError ? error.reason : "unknown"
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  await takeSlot()
  let response: Response
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new GeoRequestError("network")
  }
  if (response.status === 404) return null
  if (!response.ok) throw new GeoRequestError(geoHttpErrorReason(response.status))
  return response.json().catch(() => {
    throw new GeoRequestError("unknown")
  })
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/** Procura um endereço (ou nome de lugar), em português e só no Brasil. */
export async function geocode(address: string): Promise<GeocodeOutcome> {
  const key = serverKey()
  if (!key) return { status: "error", reason: "no-key" }

  const url =
    `${GEOCODE_URL}?text=${encodeURIComponent(address)}` +
    `&lang=pt&filter=countrycode:br&limit=1&format=json&apiKey=${encodeURIComponent(key)}`
  try {
    return parseGeocodeResponse(await requestJson(url))
  } catch (error) {
    return { status: "error", reason: reasonOf(error) }
  }
}

// ---------------------------------------------------------------------------
// Place Details
// ---------------------------------------------------------------------------

/** `null` = a Geoapify não conhece (mais) esse lugar. */
async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = serverKey()
  if (!key) throw new GeoRequestError("no-key")
  const body = await requestJson(
    `${DETAILS_URL}?id=${encodeURIComponent(placeId)}&lang=pt&apiKey=${encodeURIComponent(key)}`
  )
  return body === null ? null : parsePlaceDetails(body, placeId)
}

/** Guardado por até 24 h por lugar. Nada disso vai para o banco. */
const cachedPlaceDetails = unstable_cache(fetchPlaceDetails, ["geoapify-place-details-v1"], {
  revalidate: DETAILS_CACHE_SECONDS,
})

export type PlaceDetailsOutcome =
  | { status: "ok"; details: PlaceDetails | null }
  | { status: "error"; reason: GeoErrorReason }

export async function placeDetails(placeId: string): Promise<PlaceDetailsOutcome> {
  try {
    return { status: "ok", details: await cachedPlaceDetails(placeId) }
  } catch (error) {
    return { status: "error", reason: reasonOf(error) }
  }
}

// ---------------------------------------------------------------------------
// Route Matrix
// ---------------------------------------------------------------------------

/** Tempo e distância de trajeto, pelas ruas, de uma origem até vários destinos. */
async function fetchRouteMatrix(
  origin: LatLng,
  destinations: LatLng[],
  mode: TravelMode
): Promise<(RouteInfo | null)[]> {
  const key = serverKey()
  if (!key) throw new GeoRequestError("no-key")
  const point = ({ lat, lng }: LatLng) => ({ location: [lng, lat] })
  const body = await requestJson(`${ROUTE_MATRIX_URL}?apiKey=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: mode === "driving" ? "drive" : "walk",
      sources: [point(origin)],
      targets: destinations.map(point),
    }),
  })
  return parseRouteMatrix(body, destinations.length)
}

const cachedRouteMatrix = unstable_cache(fetchRouteMatrix, ["geoapify-route-matrix-v1"], {
  revalidate: ROUTES_CACHE_SECONDS,
})

export type RouteMatrixOutcome =
  | { status: "ok"; routes: (RouteInfo | null)[] }
  | { status: "error"; reason: GeoErrorReason }

export async function routeMatrix(
  origin: LatLng,
  destinations: LatLng[],
  mode: TravelMode
): Promise<RouteMatrixOutcome> {
  // Origem arredondada em ~100 m: andar um quarteirão reaproveita o cache.
  const rounded = { lat: Math.round(origin.lat * 1000) / 1000, lng: Math.round(origin.lng * 1000) / 1000 }
  try {
    return { status: "ok", routes: await cachedRouteMatrix(rounded, destinations, mode) }
  } catch (error) {
    return { status: "error", reason: reasonOf(error) }
  }
}

// ---------------------------------------------------------------------------
// Places (lugares por perto)
// ---------------------------------------------------------------------------

/** Os lugares com nome num raio de ~150 m (1 crédito por pedido, até 20 lugares). */
async function fetchNearbyPlaces(center: LatLng): Promise<NearbyPlace[]> {
  const key = serverKey()
  if (!key) throw new GeoRequestError("no-key")
  const point = `${center.lng},${center.lat}`
  const body = await requestJson(
    `${PLACES_URL}?categories=${NEARBY_CATEGORIES}` +
      `&filter=circle:${point},${NEARBY_RADIUS_METERS}&bias=proximity:${point}` +
      `&limit=20&lang=pt&apiKey=${encodeURIComponent(key)}`
  )
  return parseNearbyPlaces(body)
}

/** Guardado por até 24 h por pedaço do mapa (~55 m): o mesmo quarteirão não gasta de novo. */
const cachedNearbyPlaces = unstable_cache(fetchNearbyPlaces, ["geoapify-nearby-v1"], {
  revalidate: NEARBY_CACHE_SECONDS,
})

export type NearbyOutcome =
  | { status: "ok"; places: NearbyPlace[] }
  | { status: "error"; reason: GeoErrorReason }

export async function nearbyPlaces(position: LatLng): Promise<NearbyOutcome> {
  try {
    return { status: "ok", places: await cachedNearbyPlaces(nearbyCacheCenter(position)) }
  } catch (error) {
    return { status: "error", reason: reasonOf(error) }
  }
}

// ---------------------------------------------------------------------------

/**
 * Roda `fn` sobre a lista com no máximo `limit` chamadas ao mesmo tempo. A
 * ordem do resultado é a da entrada.
 */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
