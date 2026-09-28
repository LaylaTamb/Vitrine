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
import type { Tag } from "@/lib/domain/types"

export interface StructureImpact {
  total: number
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

export interface CategoryInput {
  name: string
  icon: string | null
  color: string | null
  estrutura: unknown
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
  moveEntriesToFolder(input: {
    ids: string[]
    categoryId: string
    folderId: string | null
  }): Result

  // ---- itens --------------------------------------------------------------
  createEntry(input: EntryInput): Result<{ id: string }>
  updateEntry(input: EntryInput & { id: string }): Result
  deleteEntry(input: { id: string; categoryId: string }): Result
  bulkDeleteEntries(input: { ids: string[]; categoryId: string }): Result
  bulkTag(input: {
    ids: string[]
    categoryId: string
    tagId: string
    mode: "add" | "remove"
  }): Result
  movePreview(input: { ids: string[]; categoryId: string; toCategoryId: string }): Result<MovePreview>
  bulkMoveEntries(input: { ids: string[]; categoryId: string; toCategoryId: string }): Result

  // ---- tags ---------------------------------------------------------------
  createTag(input: { name: string; color: string }): Result<Tag>
  updateTag(input: { id: string; name: string; color: string }): Result
  deleteTag(input: { id: string }): Result
  searchEntriesForTag(input: { tagId: string; query: string }): Result<EntryPickerRow[]>
  applyTagToEntries(input: { tagId: string; ids: string[] }): Result
}
