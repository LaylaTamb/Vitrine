/**
 * Localização dos itens: o que precisa ser procurado na Geoapify, o que já
 * pode virar pino e como as linhas de `entry_places` acompanham os campos.
 *
 * `entry_places` é um cache: o texto do endereço mora em `custom_fields`, e
 * uma linha só vale enquanto `address` for igual ao texto atual do campo.
 * Assim, um endereço editado nunca mostra o pino antigo — mesmo antes de ser
 * procurado de novo. Os dados vêm do OpenStreetMap (via Geoapify) e podem
 * ficar guardados sem prazo.
 */

import { locationFieldsOf } from "./fields"
import type { CustomFields, EntryPlace, Estrutura } from "./types"

/** Um campo de Localização preenchido: o que se procura. */
export interface LocationTarget {
  fieldId: string
  fieldLabel: string
  address: string
}

/** O texto que se compara e se procura — o mesmo `trim` da coerção. */
export function addressOf(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

export function locationTargets(estrutura: Estrutura, custom: CustomFields): LocationTarget[] {
  return locationFieldsOf(estrutura)
    .map((field) => ({ fieldId: field.id, fieldLabel: field.nome, address: addressOf(custom[field.id]) }))
    .filter((target) => target.address !== "")
}

export function placeKey(entryId: string, fieldId: string): string {
  return `${entryId}|${fieldId}`
}

export function placesByKey(places: EntryPlace[]): Map<string, EntryPlace> {
  return new Map(places.map((place) => [placeKey(place.entry_id, place.field_id), place]))
}

/** Pode virar pino: localizado e com o endereço de agora. */
export function isPlaceUsable(
  place: EntryPlace | undefined,
  address: string
): place is EntryPlace & { lat: number; lng: number } {
  return (
    place !== undefined &&
    place.status === "ok" &&
    place.address === address &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  )
}

/**
 * Quanto insistir na busca:
 * - `pending`: endereço novo, mudado ou pendente — não insiste no que falhou
 *   com o mesmo texto (depois de salvar um item, depois de converter Texto →
 *   Localização);
 * - `retry`: também tenta de novo o que deu "não encontrado" ou erro antes
 *   de `retryBefore` (o botão "Tentar de novo").
 */
export type GeocodeMode = "pending" | "retry"

export interface GeocodePolicy {
  now: number
  mode: GeocodeMode
  /**
   * Só no `retry`: falha registrada a partir deste instante não é tentada de
   * novo — é o que impede um lote de repetir o que ele mesmo acabou de tentar.
   */
  retryBefore?: number
}

export function needsGeocode(
  address: string,
  place: EntryPlace | undefined,
  policy: GeocodePolicy
): boolean {
  const { now, mode } = policy
  if (!place || place.address !== address || place.status === "pending") return true
  if (place.status === "ok") return false

  // "não encontrado" ou erro, com o mesmo texto
  if (mode !== "retry") return false
  const attempted = place.geocoded_at ? Date.parse(place.geocoded_at) : Number.NaN
  return !Number.isFinite(attempted) || attempted < (policy.retryBefore ?? now)
}

export interface PendingGeocode {
  entryId: string
  fieldId: string
  address: string
}

/** Tudo do acervo que precisa ser procurado, na ordem das categorias e dos itens. */
export function pendingGeocodes(
  categories: { id: string; estrutura: Estrutura }[],
  entries: { id: string; category_id: string; custom_fields: CustomFields }[],
  places: EntryPlace[],
  policy: GeocodePolicy
): PendingGeocode[] {
  const estruturaOf = new Map(categories.map((category) => [category.id, category.estrutura]))
  const byKey = placesByKey(places)
  const out: PendingGeocode[] = []

  for (const entry of entries) {
    const estrutura = estruturaOf.get(entry.category_id)
    if (!estrutura) continue
    for (const target of locationTargets(estrutura, entry.custom_fields)) {
      const place = byKey.get(placeKey(entry.id, target.fieldId))
      if (needsGeocode(target.address, place, policy)) {
        out.push({ entryId: entry.id, fieldId: target.fieldId, address: target.address })
      }
    }
  }

  return out
}

/** As linhas de um item que não correspondem mais a um campo de Localização preenchido. */
export function staleFieldIds(
  places: Pick<EntryPlace, "field_id">[],
  targets: LocationTarget[]
): string[] {
  const live = new Set(targets.map((target) => target.fieldId))
  return places.map((place) => place.field_id).filter((fieldId) => !live.has(fieldId))
}

/**
 * Ao mover itens de categoria: cada linha vai para o id do campo de destino
 * que recebeu o valor (`fieldMap` da migração). Valor descartado = linha some.
 */
export function remapPlaces(
  places: EntryPlace[],
  fieldMaps: Map<string, Record<string, string>>
): EntryPlace[] {
  const out: EntryPlace[] = []
  for (const place of places) {
    const target = fieldMaps.get(place.entry_id)?.[place.field_id]
    if (target) out.push({ ...place, field_id: target })
  }
  return out
}
