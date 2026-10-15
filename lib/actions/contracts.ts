/**
 * O contrato de toda escrita que um componente pode pedir.
 *
 * Os componentes não importam Server Action nenhuma direto: pedem
 * `useVitrine().actions` e recebem um objeto com esta forma. No app de
 * verdade ele aponta para as Server Actions (Supabase); na demonstração
 * (`/demo`), para o acervo em memória do navegador. Os dois lados são
 * checados contra esta interface pelo TypeScript — se um ganhar método novo
 * e o outro não, o build quebra.
 */
import type { ActionResult } from "@/lib/actions/result"
import type { SortKey } from "@/lib/domain/filter"
import type { LatLng } from "@/lib/domain/map"
import type { TravelMode } from "@/lib/domain/maps-links"
import type { PlaceDetails, RouteInfo } from "@/lib/domain/place-details"
import type { GeocodeMode } from "@/lib/domain/places"
import type { Tag } from "@/lib/domain/types"

export interface StructureImpact {
  total: number
  /** Quantos itens têm nota — o que se perde ao desligar as estrelas. */
  rated: number
  /** id do campo → quantos itens têm valor gravado nele */
  filled: Record<string, number>
  /** id do campo → opção removida → quantos itens têm exatamente esse valor hoje */
  optionUsage: Record<string, Record<string, number>>
}

export interface MovePreview {
  /** Quantos valores de campo serão descartados na migração. */
  dropped: number
  kept: number
}

export interface EntryPickerRow {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  /** Já tem essa tag — aparece marcado e travado na lista. */
  hasTag: boolean
}

export interface EntryInput {
  categoryId: string
  /** Subpasta da categoria. Ausente = não mexe; `null` = raiz. */
  folderId?: string | null
  name: string
  rating: number | null
  imageUrl: string | null
  imageDisplay: { x: number; y: number; zoom: number }
  customFields: Record<string, string | number>
  tagIds: string[]
}

/** O que aconteceu com um campo de Localização depois de salvar o item. */
export interface GeocodeFieldResult {
  fieldId: string
  fieldLabel: string
  address: string
  status: "ok" | "not_found" | "error"
  /** Só em `error`: a frase pronta para o toast. */
  error?: string
}

/** Um lote de localizações pendentes. */
export interface GeocodeBatchResult {
  located: number
  notFound: number
  failed: number
  /** Quantos ainda esperam — o cliente chama de novo enquanto houver. */
  remaining: number
  /** A primeira falha do lote, em português (cota, chave, rede…). */
  error?: string
}

export interface CategoryInput {
  name: string
  icon: string | null
  color: string | null
  estrutura: unknown
  /** `false` = lista simples: sem nota de estrelas (desligar apaga as notas). */
  ratingEnabled: boolean
  defaultSort: SortKey
}

type Result<T = undefined> = Promise<ActionResult<T>>

export interface VitrineActions {
  // ---- pastas das Coleções ------------------------------------------------
  createFolder(input: { name: string; parentFolderId: string | null }): Result<{ id: string }>
  renameFolder(input: { id: string; name: string }): Result
  moveFolder(input: { id: string; targetFolderId: string | null }): Result
  deleteFolder(input: { id: string }): Result
  reorderLevel(input: { items: { kind: "folder" | "category"; id: string }[] }): Result

  // ---- categorias ---------------------------------------------------------
  createCategory(input: CategoryInput & { folderId: string | null }): Result<{ id: string }>
  updateCategory(
    input: CategoryInput & { id: string; removedFieldIds?: string[] }
  ): Result
  moveCategory(input: { id: string; targetFolderId: string | null }): Result
  deleteCategory(input: { id: string }): Result
  structureImpact(input: {
    categoryId: string
    fieldIds: string[]
    fieldOptions?: { fieldId: string; options: string[] }[]
  }): Result<StructureImpact>

  // ---- subpastas de uma categoria -----------------------------------------
  createEntryFolder(input: {
    categoryId: string
    name: string
    parentFolderId: string | null
  }): Result<{ id: string }>
  renameEntryFolder(input: { id: string; name: string }): Result
  moveEntryFolder(input: { id: string; targetFolderId: string | null }): Result
  deleteEntryFolder(input: { id: string; keepContents: boolean }): Result
  /** Grava a ordem de um nível de subpastas depois de um arraste. */
  reorderEntryFolders(input: { categoryId: string; ids: string[] }): Result
  moveEntriesToFolder(input: {
    ids: string[]
    categoryId: string
    folderId: string | null
  }): Result

  // ---- itens --------------------------------------------------------------
  createEntry(input: EntryInput): Result<{ id: string }>
  updateEntry(input: EntryInput & { id: string }): Result
  deleteEntry(input: { id: string; categoryId: string }): Result
  /** Grava a "ordem manual" de um nível de itens depois de um arraste. */
  reorderEntries(input: { categoryId: string; ids: string[] }): Result
  bulkDeleteEntries(input: { ids: string[]; categoryId: string }): Result
  bulkTag(input: {
    ids: string[]
    categoryId: string
    tagId: string
    mode: "add" | "remove"
  }): Result
  movePreview(input: { ids: string[]; categoryId: string; toCategoryId: string }): Result<MovePreview>
  bulkMoveEntries(input: { ids: string[]; categoryId: string; toCategoryId: string }): Result

  // ---- mapa: localização dos itens ----------------------------------------
  /** Procura (Geoapify) os campos de Localização do item que mudaram ou estão pendentes. */
  geocodeEntryLocations(input: { entryId: string }): Result<{ results: GeocodeFieldResult[] }>
  /** Um lote (até 50) do que está pendente no acervo inteiro — ou só numa categoria. */
  geocodePendingLocations(input: {
    categoryId?: string
    mode?: GeocodeMode
    startedAt?: string
  }): Result<GeocodeBatchResult>
  /** "Onde estou" digitado nas Sugestões. Procurado, nunca gravado. */
  geocodeAddress(input: { query: string }): Result<{ lat: number; lng: number; label: string }>
  /**
   * Horário, tipo, telefone e site de até 20 lugares do próprio acervo (por place_id).
   * `null` = não há dados do lugar; ausente = falhou agora.
   */
  placeDetails(input: {
    placeIds: string[]
  }): Result<{ details: Record<string, PlaceDetails | null>; error?: string }>
  /** Tempo e distância de trajeto até 10 lugares, chaveados por `key`. */
  routeTimes(input: {
    origin: LatLng
    destinations: (LatLng & { key: string })[]
    mode: TravelMode
  }): Result<{ routes: Record<string, RouteInfo | null> }>

  // ---- tags ---------------------------------------------------------------
  createTag(input: { name: string; color: string }): Result<Tag>
  updateTag(input: { id: string; name: string; color: string }): Result
  deleteTag(input: { id: string }): Result
  searchEntriesForTag(input: { tagId: string; query: string }): Result<EntryPickerRow[]>
  applyTagToEntries(input: { tagId: string; ids: string[] }): Result
}
