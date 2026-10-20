/**
 * Google Maps pelo Takeout (não existe API dos "Salvos"):
 *   • "Saved Places.json" (Maps — seus lugares): os salvos com estrela, um
 *     GeoJSON já com coordenadas;
 *   • um .csv por lista da pasta "Saved"/"Salvos" (Título, Observação, URL…),
 *     sem coordenadas — que às vezes vêm escondidas no link.
 * O Takeout em português pode trazer nomes de arquivo e colunas traduzidos:
 * o formato é reconhecido pelo conteúdo, não pelo nome.
 */

import { csvRecords, pick } from "./csv"

export const STARRED_LIST = "Salvos com estrela"
export const GOOGLE_FOLDER = "Google Maps"

/** Os campos de cada categoria importada (ids fixos: reimportar acha os mesmos). */
export const GOOGLE_ESTRUTURA = [
  { id: "f_local", nome: "Localização", tipo: "location" as const },
  { id: "f_anotacao", nome: "Sua anotação", tipo: "str" as const },
]

export interface GooglePlace {
  title: string
  note: string | null
  url: string
  address: string | null
  lat: number | null
  lng: number | null
}

export interface GoogleList {
  name: string
  places: GooglePlace[]
}

const MAX_TITLE = 200
const MAX_NOTE = 2000

function clean(value: unknown, max: number): string | null {
  const text = typeof value === "string" ? value.trim() : ""
  return text ? text.slice(0, max) : null
}

function validCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

/** As coordenadas que às vezes vêm no link (`!3d…!4d…`, `@lat,lng` ou `?q=lat,lng`). */
export function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(url)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (validCoords(lat, lng)) return { lat, lng }
  }
  return null
}

/** "Takeout/Salvos/Quero ir.csv" → "Quero ir". */
export function listNameFromPath(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path
  return file.replace(/\.csv$/i, "").trim().slice(0, 80) || "Lista do Google"
}

/**
 * O "Saved Places.json" → os lugares. `null` = não é esse arquivo. Aceita o
 * formato de hoje (`google_maps_url`, `location.name`) e o antigo
 * (`Google Maps URL`, `Location.Business Name`).
 */
export function parseSavedPlacesJson(text: string): GooglePlace[] | null {
  let data: unknown
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return null
  }
  const features = (data as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return null

  let recognized = false
  const places: GooglePlace[] = []
  for (const feature of features) {
    const item = feature as {
      geometry?: { coordinates?: unknown }
      properties?: Record<string, unknown>
    } | null
    const props = item?.properties ?? {}
    const url = clean(props.google_maps_url ?? props["Google Maps URL"], 2000)
    if (!url) continue
    recognized = true
    const location = (props.location ?? props.Location ?? {}) as Record<string, unknown>
    const address = clean(location.address ?? location.Address, 300)
    const title =
      clean(location.name ?? location["Business Name"] ?? props.Title, MAX_TITLE) ??
      address?.slice(0, MAX_TITLE)
    if (!title) continue

    let lat: number | null = null
    let lng: number | null = null
    const coordinates = item?.geometry?.coordinates
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const [x, y] = coordinates.map(Number)
      if (validCoords(y, x)) {
        lat = y
        lng = x
      }
    }
    const geo = location["Geo Coordinates"] as Record<string, unknown> | undefined
    if (lat === null && geo) {
      const y = Number(geo.Latitude)
      const x = Number(geo.Longitude)
      if (validCoords(y, x)) {
        lat = y
        lng = x
      }
    }
    if (lat === null) {
      const fromUrl = coordsFromMapsUrl(url)
      if (fromUrl) ({ lat, lng } = fromUrl)
    }

    places.push({
      title,
      note: clean(props.Comment ?? props.comment, MAX_NOTE),
      url,
      address,
      lat,
      lng,
    })
  }
  return recognized ? places : null
}

/**
 * O .csv de uma lista → os lugares. `null` = não parece uma lista do Google
 * (sem as colunas de título e URL).
 */
export function parseSavedListCsv(text: string): GooglePlace[] | null {
  const { header, records } = csvRecords(text)
  const hasTitle = header.some((name) => ["title", "titulo", "nome"].includes(name))
  if (!hasTitle || !header.includes("url")) return null

  const places: GooglePlace[] = []
  for (const record of records) {
    const title = clean(pick(record, ["Title", "Título", "Nome"]), MAX_TITLE)
    const url = clean(pick(record, ["URL"]), 2000)
    if (!title || !url) continue
    const notes = [
      pick(record, ["Note", "Observação", "Nota", "Anotação"]),
      pick(record, ["Comment", "Comentário"]),
    ]
      .filter(Boolean)
      .join(" — ")
    const coords = coordsFromMapsUrl(url)
    places.push({
      title,
      note: clean(notes, MAX_NOTE),
      url,
      address: null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    })
  }
  return places
}

/**
 * Um arquivo qualquer do Takeout → a lista que ele é, ou `null`. O JSON dos
 * salvos com estrela vira a lista "Salvos com estrela".
 */
export function parseGoogleFile(path: string, text: string): GoogleList | null {
  if (/\.json$/i.test(path)) {
    const places = parseSavedPlacesJson(text)
    return places ? { name: STARRED_LIST, places } : null
  }
  if (/\.csv$/i.test(path)) {
    const places = parseSavedListCsv(text)
    return places ? { name: listNameFromPath(path), places } : null
  }
  return null
}

/** Junta listas de mesmo nome (o Takeout às vezes reparte) e tira repetidos. */
export function mergeGoogleLists(lists: GoogleList[]): GoogleList[] {
  const byName = new Map<string, GoogleList>()
  for (const list of lists) {
    const current = byName.get(list.name) ?? { name: list.name, places: [] }
    const seen = new Set(current.places.map((place) => place.url))
    for (const place of list.places) {
      if (seen.has(place.url)) continue
      seen.add(place.url)
      current.places.push(place)
    }
    byName.set(list.name, current)
  }
  return [...byName.values()].filter((list) => list.places.length > 0)
}

/**
 * O \`source_id\` de um lugar importado: a lista + o link. O mesmo lugar em
 * duas listas vira dois itens (um em cada categoria); reimportar a mesma
 * lista não duplica.
 */
export function googleSourceId(listName: string, url: string): string {
  return `${listName}|${url}`.slice(0, 200)
}

/** O texto do campo Localização: o endereço, quando vem; senão, o nome. */
export function googleLocationText(place: GooglePlace): string {
  return (place.address || place.title).slice(0, 300)
}
