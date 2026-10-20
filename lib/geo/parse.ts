/**
 * O tratamento das respostas da Geoapify (dados do OpenStreetMap) — funções
 * puras, sem rede e sem chave, testadas com respostas de exemplo. Quem faz as
 * chamadas de verdade é `client.ts` (só servidor).
 *
 * Erros daqui NÃO passam por `translateError`: lá "429 / rate limit" vira
 * "muitos e-mails", que aqui não faz sentido.
 */

import { parseOpeningHours } from "@/lib/domain/opening-hours"
import type { NearbyPlace } from "@/lib/domain/nearby"
import { typeLabelOf, type PlaceDetails, type RouteInfo } from "@/lib/domain/place-details"

/** Por que uma chamada falhou — vira frase em `geoErrorMessage`. */
export type GeoErrorReason = "no-key" | "quota" | "denied" | "invalid" | "network" | "unknown"

export type GeocodeOutcome =
  | {
      status: "ok"
      lat: number
      lng: number
      placeId: string | null
      formattedAddress: string | null
      /** O nome do lugar, quando é um estabelecimento ou prédio com nome. */
      name: string | null
      /** "amenity", "building", "street", "suburb"… — o banco só cataloga os precisos. */
      resultType: string | null
      /** "node/123", "way/456"… quando a resposta traz. */
      osmId: string | null
    }
  | { status: "not_found" }
  | { status: "error"; reason: GeoErrorReason }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** A Geoapify responde erro pelo status HTTP (o corpo traz `{ statusCode, error, message }`). */
export function geoHttpErrorReason(status: number): GeoErrorReason {
  if (status === 429) return "quota"
  if (status === 401 || status === 403) return "denied"
  if (status === 400) return "invalid"
  return "unknown"
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Abaixo disto, a Geoapify está chutando: "asdfgh" vira qualquer rua com
 * nome parecido. Melhor "não encontrado" do que um pino no lugar errado.
 */
export const MIN_CONFIDENCE = 0.4

/** Tão vago que o pino não ajuda: o país ou o estado inteiro. */
const TOO_VAGUE = new Set(["country", "state"])

const OSM_TYPES: Record<string, string> = {
  n: "node",
  w: "way",
  r: "relation",
  node: "node",
  way: "way",
  relation: "relation",
}

/** O id do OpenStreetMap ("node/123"), se a resposta trouxer (`datasource.raw`). */
function osmIdOf(result: Record<string, unknown>): string | null {
  const raw = asRecord(asRecord(result.datasource)?.raw)
  const type = typeof raw?.osm_type === "string" ? OSM_TYPES[raw.osm_type.toLowerCase()] : null
  const id = raw?.osm_id
  const number = typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id)) ? id : null
  return type && number !== null ? `${type}/${number}` : null
}

/** Resposta do Geocoding (`format=json`) → resultado. Usa o primeiro (o mais provável). */
export function parseGeocodeResponse(body: unknown): GeocodeOutcome {
  const data = asRecord(body)
  if (!data || !Array.isArray(data.results)) return { status: "error", reason: "unknown" }

  const first = asRecord(data.results[0])
  if (!first) return { status: "not_found" }

  const lat = finite(first.lat)
  const lng = finite(first.lon)
  if (lat === null || lng === null) return { status: "error", reason: "unknown" }

  const confidence = finite(asRecord(first.rank)?.confidence)
  const type = typeof first.result_type === "string" ? first.result_type : ""
  if ((confidence !== null && confidence < MIN_CONFIDENCE) || TOO_VAGUE.has(type)) {
    return { status: "not_found" }
  }

  return {
    status: "ok",
    lat,
    lng,
    placeId: text(first.place_id),
    formattedAddress: text(first.formatted),
    name: text(first.name),
    resultType: text(first.result_type),
    osmId: osmIdOf(first),
  }
}

// ---------------------------------------------------------------------------
// Place Details
// ---------------------------------------------------------------------------

/**
 * Resposta do Place Details (um GeoJSON) → os dados da tela. A feição certa
 * é a de `feature_type: "details"`; sem nenhuma feição, `null`.
 */
export function parsePlaceDetails(body: unknown, placeId: string): PlaceDetails | null {
  const features = asRecord(body)?.features
  if (!Array.isArray(features) || features.length === 0) return null
  const feature =
    features.map(asRecord).find((item) => asRecord(item?.properties)?.feature_type === "details") ??
    asRecord(features[0])
  const properties = asRecord(feature?.properties)
  if (!properties) return null

  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((item): item is string => typeof item === "string")
    : []
  const openingHoursText = text(properties.opening_hours)
  const offsetSeconds = finite(asRecord(properties.timezone)?.offset_STD_seconds)

  return {
    placeId,
    name: text(properties.name),
    typeLabel: typeLabelOf(categories, text(asRecord(properties.catering)?.cuisine)),
    periods: parseOpeningHours(openingHoursText),
    openingHoursText,
    utcOffsetMinutes: offsetSeconds === null ? null : Math.round(offsetSeconds / 60),
    phone: text(asRecord(properties.contact)?.phone),
    website: text(properties.website),
  }
}

// ---------------------------------------------------------------------------
// Places (lugares por perto)
// ---------------------------------------------------------------------------

/**
 * A resposta do Places (um GeoJSON) → os lugares com nome, do mais perto
 * para o mais longe (`distance`, quando vem; senão, na ordem da resposta).
 */
export function parseNearbyPlaces(body: unknown): NearbyPlace[] {
  const features = asRecord(body)?.features
  if (!Array.isArray(features)) return []
  const seen = new Set<string>()
  const ranked: { place: NearbyPlace; distance: number }[] = []
  features.forEach((item, index) => {
    const properties = asRecord(asRecord(item)?.properties)
    if (!properties) return
    const name = text(properties.name)
    const placeId = text(properties.place_id)
    const lat = finite(properties.lat)
    const lng = finite(properties.lon)
    if (!name || !placeId || lat === null || lng === null || seen.has(placeId)) return
    seen.add(placeId)
    const categories = Array.isArray(properties.categories)
      ? properties.categories.filter((value): value is string => typeof value === "string")
      : []
    const raw = asRecord(asRecord(properties.datasource)?.raw)
    const openingHoursText = text(properties.opening_hours) ?? text(raw?.opening_hours)
    const offsetSeconds = finite(asRecord(properties.timezone)?.offset_STD_seconds)
    ranked.push({
      distance: finite(properties.distance) ?? 1_000_000 + index,
      place: {
        placeId,
        name,
        lat,
        lng,
        typeLabel: typeLabelOf(categories, text(asRecord(properties.catering)?.cuisine)),
        address: text(properties.address_line2) ?? text(properties.formatted),
        osmId: osmIdOf(properties),
        periods: parseOpeningHours(openingHoursText),
        openingHoursText,
        utcOffsetMinutes: offsetSeconds === null ? null : Math.round(offsetSeconds / 60),
      },
    })
  })
  return ranked.sort((a, b) => a.distance - b.distance).map((item) => item.place)
}

// ---------------------------------------------------------------------------
// Route Matrix
// ---------------------------------------------------------------------------

/**
 * A resposta do Route Matrix (uma origem, vários destinos) → o trajeto de
 * cada destino, na ordem do pedido. Destino sem rota: `null`.
 */
export function parseRouteMatrix(body: unknown, destinations: number): (RouteInfo | null)[] {
  const out: (RouteInfo | null)[] = Array.from({ length: destinations }, () => null)
  const rows = asRecord(body)?.sources_to_targets
  const row = Array.isArray(rows) ? rows[0] : null
  if (!Array.isArray(row)) return out

  row.forEach((cell, position) => {
    const data = asRecord(cell)
    if (!data) return
    const index = finite(data.target_index) ?? position
    const meters = finite(data.distance)
    const seconds = finite(data.time)
    if (!Number.isInteger(index) || index < 0 || index >= destinations) return
    if (meters === null || seconds === null) return
    out[index] = { distanceMeters: meters, durationSeconds: seconds }
  })

  return out
}

// ---------------------------------------------------------------------------

/** A frase em português para cada falha. */
export function geoErrorMessage(reason: GeoErrorReason): string {
  switch (reason) {
    case "no-key":
      return "O mapa não está configurado: falta a variável GEOAPIFY_API_KEY no servidor."
    case "quota":
      return "Os créditos grátis da Geoapify acabaram por hoje. Amanhã eles voltam."
    case "denied":
      return "A Geoapify recusou a chave. Confira a GEOAPIFY_API_KEY."
    case "invalid":
      return "A Geoapify não entendeu esse pedido."
    case "network":
      return "Não consegui falar com a Geoapify agora. Tente de novo em instantes."
    case "unknown":
    default:
      return "A Geoapify teve um problema agora. Tente de novo em instantes."
  }
}
