"use server"

import { revalidatePath } from "next/cache"

import type { GeocodeBatchResult, GeocodeFieldResult } from "@/lib/actions/contracts"
import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  addNearbyPlaceSchema,
  geocodeAddressSchema,
  geocodeEntrySchema,
  geocodePendingSchema,
  latLngSchema,
  normalizeRating,
  placeDetailsSchema,
  placeRatingsSchema,
  routeTimesSchema,
} from "@/lib/actions/schemas"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import { parseCustomFields, parseEstrutura } from "@/lib/domain/fields"
import type { LatLng } from "@/lib/domain/map"
import type { TravelMode } from "@/lib/domain/maps-links"
import {
  EMPTY_RATINGS,
  NEARBY_SHOWN,
  parsePlaceRatings,
  placeAddressText,
  type NearbyPlace,
  type PlaceRatings,
} from "@/lib/domain/nearby"
import type { PlaceDetails, RouteInfo } from "@/lib/domain/place-details"
import {
  locationTargets,
  needsGeocode,
  pendingGeocodes,
  placeKey,
  placesByKey,
  staleFieldIds,
  type GeocodeMode,
} from "@/lib/domain/places"
import type { EntryPlace } from "@/lib/domain/types"
import {
  geocode,
  mapWithLimit,
  nearbyPlaces,
  placeDetails,
  routeMatrix,
  serverKey,
} from "@/lib/geo/client"
import {
  geoErrorMessage,
  type GeocodeOutcome,
  type GeoErrorReason,
} from "@/lib/geo/parse"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Quantos endereços um lote procura — e quantos ao mesmo tempo. A Geoapify
 * aceita 5 por segundo (o cliente espaça os pedidos): 20 cabem em uns 4 s, bem
 * dentro do tempo de uma função na Vercel.
 */
const BATCH_SIZE = 20
const PARALLEL = 3

const MISSING_TABLE =
  "O mapa ainda não existe no banco: rode supabase/11_entry_places.sql no SQL Editor."

function failTable(error: unknown): ActionResult<never> {
  return isMissingSchema(error) ? { ok: false, error: MISSING_TABLE } : fail(error)
}

/**
 * O resultado de uma busca virando linha de `entry_places`. Erro passageiro
 * (cota, rede) num endereço que já tinha linha não apaga o que havia — o
 * `place_id` continua valendo, e a próxima rodada tenta de novo.
 */
function rowFor(
  ownerId: string,
  target: { entryId: string; fieldId: string; address: string },
  outcome: GeocodeOutcome,
  previous: EntryPlace | undefined,
  at: string
): EntryPlace | null {
  if (outcome.status === "error" && previous?.address === target.address) return null
  return {
    entry_id: target.entryId,
    field_id: target.fieldId,
    owner_id: ownerId,
    address: target.address,
    formatted_address: outcome.status === "ok" ? outcome.formattedAddress : null,
    lat: outcome.status === "ok" ? outcome.lat : null,
    lng: outcome.status === "ok" ? outcome.lng : null,
    place_id: outcome.status === "ok" ? outcome.placeId : null,
    status: outcome.status,
    geocoded_at: at,
    // Para o catálogo comum: o banco liga o lugar quando ele é preciso (migração 18).
    place_name: outcome.status === "ok" ? outcome.name : null,
    result_type: outcome.status === "ok" ? outcome.resultType : null,
    osm_id: outcome.status === "ok" ? outcome.osmId : null,
  }
}

/** As colunas do catálogo (migração 18): gravadas só depois que ela roda. */
const CATALOG_COLUMNS = ["place_name", "result_type", "osm_id"] as const

/**
 * Grava as linhas de `entry_places`. Antes da migração 18 o banco não tem as
 * colunas do catálogo: grava de novo sem elas — o Mapa não pode parar por isso.
 */
async function upsertPlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: EntryPlace[]
): Promise<{ error: unknown }> {
  const first = await supabase
    .from("entry_places")
    .upsert(rows, { onConflict: "entry_id,field_id" })
  if (!first.error || !isMissingColumn(first.error)) return { error: first.error }

  const withoutCatalog = rows.map((row) => {
    const copy: Record<string, unknown> = { ...row }
    for (const column of CATALOG_COLUMNS) delete copy[column]
    return copy
  })
  const retry = await supabase
    .from("entry_places")
    .upsert(withoutCatalog, { onConflict: "entry_id,field_id" })
  return { error: retry.error }
}

/**
 * Depois de criar ou editar um item: procura os campos de Localização cujo
 * texto mudou (ou está pendente) e apaga as linhas de campo vazio.
 * O item já foi salvo — isto nunca impede o salvamento.
 */
export async function geocodeEntryLocationsAction(input: {
  entryId: string
}): Promise<ActionResult<{ results: GeocodeFieldResult[] }>> {
  const parsed = geocodeEntrySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { entryId } = parsed.data

  const [entryResult, placesResult] = await Promise.all([
    supabase
      .from("entries")
      .select("id, owner_id, category_id, custom_fields, category:categories(estrutura)")
      .eq("id", entryId)
      .maybeSingle(),
    supabase.from("entry_places").select("*").eq("entry_id", entryId),
  ])

  if (placesResult.error) return failTable(placesResult.error)
  if (entryResult.error) return fail(entryResult.error)

  const entry = entryResult.data as {
    id: string
    owner_id: string
    category_id: string
    custom_fields: unknown
    category: { estrutura: unknown } | null
  } | null
  if (!entry) return { ok: false, error: "Esse item não existe mais." }
  if (entry.owner_id !== user.id) return { ok: false, error: "Você só pode editar o que é seu." }

  const targets = locationTargets(
    parseEstrutura(entry.category?.estrutura),
    parseCustomFields(entry.custom_fields)
  )
  const places = (placesResult.data ?? []) as EntryPlace[]
  const byField = new Map(places.map((place) => [place.field_id, place]))
  const now = Date.now()

  // Campo apagado (ou que deixou de ser Localização): a linha sai.
  const stale = staleFieldIds(places, targets)
  if (stale.length > 0) {
    const { error } = await supabase
      .from("entry_places")
      .delete()
      .eq("entry_id", entryId)
      .in("field_id", stale)
    if (error) return fail(error)
  }

  // Mesmo endereço já localizado: a Geoapify não é chamada.
  const todo = targets.filter((target) =>
    needsGeocode(target.address, byField.get(target.fieldId), { now, mode: "pending" })
  )
  if (todo.length > 0 && !serverKey()) return { ok: false, error: geoErrorMessage("no-key") }

  const at = new Date(now).toISOString()
  const outcomes = await mapWithLimit(todo, PARALLEL, (target) => geocode(target.address))
  const rows = todo
    .map((target, index) =>
      rowFor(user.id, { entryId, ...target }, outcomes[index], byField.get(target.fieldId), at)
    )
    .filter((row): row is EntryPlace => row !== null)

  if (rows.length > 0) {
    const { error } = await upsertPlaces(supabase, rows)
    if (error) return fail(error)
  }

  if (stale.length > 0 || rows.length > 0) {
    revalidatePath("/mapa")
    revalidatePath(`/categoria/${entry.category_id}/${entryId}`)
  }

  return ok({
    results: todo.map((target, index): GeocodeFieldResult => {
      const outcome = outcomes[index]
      return {
        fieldId: target.fieldId,
        fieldLabel: target.fieldLabel,
        address: target.address,
        status: outcome.status,
        ...(outcome.status === "error" ? { error: geoErrorMessage(outcome.reason) } : {}),
      }
    }),
  })
}

/**
 * Um lote do que está pendente: até 20 endereços. Serve para a conversão
 * Texto → Localização, para o que veio de um backup e para o "Tentar de
 * novo". O cliente chama de novo enquanto `remaining > 0`.
 */
export async function geocodePendingLocationsAction(input: {
  categoryId?: string
  mode?: GeocodeMode
  startedAt?: string
}): Promise<ActionResult<GeocodeBatchResult>> {
  const parsed = geocodePendingSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  if (!serverKey()) return { ok: false, error: geoErrorMessage("no-key") }

  const supabase = await createClient()
  const { categoryId, mode, startedAt } = parsed.data

  let categoriesQuery = supabase.from("categories").select("id, estrutura").eq("owner_id", user.id)
  let entriesQuery = supabase
    .from("entries")
    .select("id, category_id, custom_fields")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
  if (categoryId) {
    categoriesQuery = categoriesQuery.eq("id", categoryId)
    entriesQuery = entriesQuery.eq("category_id", categoryId)
  }

  const [categoriesResult, entriesResult, placesResult] = await Promise.all([
    categoriesQuery,
    entriesQuery,
    supabase.from("entry_places").select("*").eq("owner_id", user.id),
  ])
  if (placesResult.error) return failTable(placesResult.error)
  if (categoriesResult.error) return fail(categoriesResult.error)
  if (entriesResult.error) return fail(entriesResult.error)

  const categories = ((categoriesResult.data ?? []) as { id: string; estrutura: unknown }[]).map(
    (row) => ({ id: row.id, estrutura: parseEstrutura(row.estrutura) })
  )
  const entries = (
    (entriesResult.data ?? []) as { id: string; category_id: string; custom_fields: unknown }[]
  ).map((row) => ({ ...row, custom_fields: parseCustomFields(row.custom_fields) }))
  const places = (placesResult.data ?? []) as EntryPlace[]

  const now = Date.now()
  const queue = pendingGeocodes(categories, entries, places, {
    now,
    mode,
    retryBefore: startedAt ? Date.parse(startedAt) : now,
  })
  const batch = queue.slice(0, BATCH_SIZE)
  if (batch.length === 0) return ok({ located: 0, notFound: 0, failed: 0, remaining: 0 })

  const at = new Date(now).toISOString()
  const byKey = placesByKey(places)
  const outcomes = await mapWithLimit(batch, PARALLEL, (item) => geocode(item.address))
  const rows = batch
    .map((item, index) =>
      rowFor(user.id, item, outcomes[index], byKey.get(placeKey(item.entryId, item.fieldId)), at)
    )
    .filter((row): row is EntryPlace => row !== null)

  if (rows.length > 0) {
    const { error } = await upsertPlaces(supabase, rows)
    if (error) return fail(error)
    revalidatePath("/mapa")
    revalidatePath("/categoria/[categoryId]/[entryId]", "page")
  }

  const firstError = outcomes.find((outcome) => outcome.status === "error")
  return ok({
    located: outcomes.filter((outcome) => outcome.status === "ok").length,
    notFound: outcomes.filter((outcome) => outcome.status === "not_found").length,
    failed: outcomes.filter((outcome) => outcome.status === "error").length,
    remaining: queue.length - batch.length,
    ...(firstError?.status === "error" ? { error: geoErrorMessage(firstError.reason) } : {}),
  })
}

// ---------------------------------------------------------------------------
// Sugestões — só leitura: nada disto vai para o banco
// ---------------------------------------------------------------------------

/** "Onde estou" digitado: vira coordenada só para esta busca. */
export async function geocodeAddressAction(input: {
  query: string
}): Promise<ActionResult<{ lat: number; lng: number; label: string }>> {
  const parsed = geocodeAddressSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  if (!serverKey()) return { ok: false, error: geoErrorMessage("no-key") }

  const outcome = await geocode(parsed.data.query)
  if (outcome.status === "not_found") {
    return { ok: false, error: "Não achei esse endereço. Tente com o bairro e a cidade." }
  }
  if (outcome.status === "error") return { ok: false, error: geoErrorMessage(outcome.reason) }
  return ok({
    lat: outcome.lat,
    lng: outcome.lng,
    label: outcome.formattedAddress ?? parsed.data.query,
  })
}

/**
 * Os dados (horário, tipo, telefone, site) de até 20 lugares, pela
 * Geoapify. Só de place_id que está no acervo de quem pede: a chave do
 * servidor não procura lugar qualquer. Resposta guardada por até 24 h no
 * servidor (`lib/geo/client.ts`).
 */
export async function placeDetailsAction(input: {
  placeIds: string[]
}): Promise<ActionResult<{ details: Record<string, PlaceDetails | null>; error?: string }>> {
  const parsed = placeDetailsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  if (!serverKey()) return { ok: false, error: geoErrorMessage("no-key") }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("entry_places")
    .select("place_id")
    .eq("owner_id", user.id)
    .in("place_id", [...new Set(parsed.data.placeIds)])
  if (error) return failTable(error)

  const allowed = [
    ...new Set(
      ((data ?? []) as { place_id: string | null }[])
        .map((row) => row.place_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const outcomes = await mapWithLimit(allowed, PARALLEL, (placeId) => placeDetails(placeId))

  const details: Record<string, PlaceDetails | null> = {}
  let failure: GeoErrorReason | null = null
  allowed.forEach((placeId, index) => {
    const outcome = outcomes[index]
    if (outcome.status === "ok") details[placeId] = outcome.details
    else failure ??= outcome.reason
  })

  return ok({ details, ...(failure ? { error: geoErrorMessage(failure) } : {}) })
}

/**
 * Tempo e distância de trajeto (Routes API) da minha posição até os lugares
 * mais próximos. A posição chega, é usada e some — nunca é gravada.
 */
export async function routeTimesAction(input: {
  origin: LatLng
  destinations: (LatLng & { key: string })[]
  mode: TravelMode
}): Promise<ActionResult<{ routes: Record<string, RouteInfo | null> }>> {
  const parsed = routeTimesSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  if (!serverKey()) return { ok: false, error: geoErrorMessage("no-key") }

  const { origin, destinations, mode } = parsed.data
  const outcome = await routeMatrix(
    origin,
    destinations.map(({ lat, lng }) => ({ lat, lng })),
    mode
  )
  if (outcome.status === "error") return { ok: false, error: geoErrorMessage(outcome.reason) }

  return ok({
    routes: Object.fromEntries(
      destinations.map((destination, index) => [destination.key, outcome.routes[index] ?? null])
    ),
  })
}

// ---------------------------------------------------------------------------
// "Você está em X?" (Etapa 4.4)
// ---------------------------------------------------------------------------

/**
 * Os lugares a até ~150 m da posição (que chega, é usada e some — nunca é
 * gravada). Sem a chave da Geoapify: nenhum, sem aviso (a faixa só não
 * aparece). Resposta guardada por até 24 h por pedaço do mapa.
 */
export async function nearbyPlacesAction(input: {
  lat: number
  lng: number
}): Promise<ActionResult<NearbyPlace[]>> {
  const parsed = latLngSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  if (!serverKey()) return ok([])
  const outcome = await nearbyPlaces(parsed.data)
  if (outcome.status === "error") return { ok: false, error: geoErrorMessage(outcome.reason) }
  return ok(outcome.places.slice(0, NEARBY_SHOWN))
}

/**
 * "No Vitrine": quem avaliou o lugar, do que eu posso ver (migração 28), e
 * onde ele já está no meu acervo. Antes da migração: ninguém.
 */
export async function placeRatingsAction(input: {
  placeId: string
  osmId: string | null
}): Promise<ActionResult<PlaceRatings>> {
  const parsed = placeRatingsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("place_ratings", {
    p_geoapify_id: parsed.data.placeId,
    p_osm_id: parsed.data.osmId,
  })
  if (error) return isMissingSchema(error) ? ok(EMPTY_RATINGS) : fail(error)
  return ok(parsePlaceRatings(data))
}

/**
 * "Adicionar": um item novo com o Nome e a Localização já prontos — com as
 * coordenadas e o catálogo, sem gastar busca de endereço. O lugar é lido de
 * novo aqui (do cache da busca por perto), nunca do que o navegador mandou.
 * Categoria sem campo Localização: entra só com o nome.
 */
export async function addNearbyPlaceAction(input: {
  lat: number
  lng: number
  placeId: string
  categoryId: string
  rating: number | null
}): Promise<ActionResult<{ entryId: string; categoryId: string; categoryName: string }>> {
  const parsed = addNearbyPlaceSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const outcome = await nearbyPlaces({ lat: parsed.data.lat, lng: parsed.data.lng })
  if (outcome.status === "error") return { ok: false, error: geoErrorMessage(outcome.reason) }
  const place = outcome.places.find((item) => item.placeId === parsed.data.placeId)
  if (!place) return { ok: false, error: "Esse lugar não está mais por perto. Abra de novo." }

  const supabase = await createClient()
  const { data: categoryRow, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, estrutura, rating_enabled")
    .eq("id", parsed.data.categoryId)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (categoryError) return fail(categoryError)
  if (!categoryRow) return { ok: false, error: "Categoria não encontrada." }
  const category = categoryRow as {
    id: string
    name: string
    estrutura: unknown
    rating_enabled: boolean
  }
  const locationField = parseEstrutura(category.estrutura).find(
    (field) => field.tipo === "location"
  )
  const address = placeAddressText(place)

  const { data: top } = await supabase
    .from("entries")
    .select("display_order")
    .eq("category_id", category.id)
    .is("folder_id", null)
    .order("display_order", { ascending: false })
    .limit(1)
  const last = (top ?? [])[0] as { display_order: number } | undefined
  const displayOrder = (last?.display_order ?? -1) + 1

  const { data: created, error } = await supabase
    .from("entries")
    .insert({
      category_id: category.id,
      owner_id: user.id,
      name: place.name.slice(0, 200),
      rating: category.rating_enabled ? normalizeRating(parsed.data.rating) : null,
      custom_fields: locationField ? { [locationField.id]: address } : {},
      display_order: displayOrder,
    })
    .select("id")
    .single()
  if (error) return fail(error)
  const entryId = (created as { id: string }).id

  if (locationField) {
    // A localização já resolvida: aparece no Mapa na hora e liga ao catálogo
    // comum (o gatilho da migração 18 trata o lugar como estabelecimento).
    await upsertPlaces(supabase, [
      {
        entry_id: entryId,
        field_id: locationField.id,
        owner_id: user.id,
        address,
        formatted_address: place.address,
        lat: place.lat,
        lng: place.lng,
        place_id: place.placeId,
        status: "ok",
        geocoded_at: new Date().toISOString(),
        place_name: place.name,
        result_type: "amenity",
        osm_id: place.osmId,
      },
    ])
  }

  revalidatePath("/")
  revalidatePath("/mapa")
  revalidatePath(`/categoria/${category.id}`)
  return ok({ entryId, categoryId: category.id, categoryName: category.name })
}
