/**
 * As escritas da demonstração: o mesmo contrato (`VitrineActions`) das
 * Server Actions, só que transformando o `DemoState` em memória em vez de
 * gravar no Supabase.
 *
 * Cada operação espelha a Server Action correspondente — mesmos schemas zod,
 * mesmas mensagens de erro, mesmas regras de domínio (coerção de campos,
 * migração ao mover de categoria, cascata ao excluir). O estado nunca é
 * mutado: toda operação produz um `DemoState` novo, o que faz o React
 * re-renderizar exatamente como um `revalidatePath` faria no app.
 */
import type { EntryPickerRow, MovePreview, StructureImpact, VitrineActions } from "@/lib/actions/contracts"
import { failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  applyTagSchema,
  bulkMoveSchema,
  bulkSchema,
  bulkTagSchema,
  createCategorySchema,
  createEntryFolderSchema,
  createFolderSchema,
  deleteEntryFolderSchema,
  deleteEntrySchema,
  entrySchema,
  idSchema,
  moveEntriesToFolderSchema,
  moveFolderSchema,
  normalizeRating,
  renameFolderSchema,
  reorderSchema,
  searchEntriesForTagSchema,
  structureImpactSchema,
  tagSchema,
  updateCategorySchema,
  updateEntrySchema,
  updateTagSchema,
} from "@/lib/actions/schemas"
import { descendantFolderIds } from "@/lib/domain/collections"
import { folderSubtree } from "@/lib/domain/entry-folders"
import { coerceCustomFields, normalizeName, parseEstrutura } from "@/lib/domain/fields"
import { migrateCustomFields } from "@/lib/domain/migrate"
import { normalizeCategoryColor, normalizeTagColor } from "@/lib/domain/tags"
import type { CustomFields, EntryWithTags, Tag } from "@/lib/domain/types"

import { DEMO_OWNER_ID, randomDemoId, type DemoState } from "./state"

export interface DemoStore {
  get(): DemoState
  set(next: DemoState): void
}

type Result<T = undefined> = Promise<ActionResult<T>>

const GONE = "Isso não existe mais — talvez tenha sido excluído."

function no(error: string): ActionResult<never> {
  return { ok: false, error }
}

/** Tira categorias e tudo que depende delas: subpastas e itens. */
function withoutCategories(state: DemoState, ids: Set<string>): DemoState {
  if (ids.size === 0) return state
  return {
    ...state,
    categories: state.categories.filter((category) => !ids.has(category.id)),
    entryFolders: state.entryFolders.filter((folder) => !ids.has(folder.category_id)),
    entries: state.entries.filter((entry) => !ids.has(entry.category_id)),
  }
}

function nextDisplayOrder<T extends { display_order: number }>(siblings: T[]): number {
  return siblings.reduce((top, item) => Math.max(top, item.display_order), -1) + 1
}

/**
 * `newId`/`now` são injetáveis para os testes; no navegador, UUID aleatório e
 * a hora de agora.
 */
export function createDemoActions(
  store: DemoStore,
  newId: () => string = randomDemoId,
  now: () => string = () => new Date().toISOString()
): VitrineActions {
  const get = store.get
  const commit = (next: DemoState) => store.set(next)

  const updateEntries = (
    state: DemoState,
    match: (entry: EntryWithTags) => boolean,
    patch: (entry: EntryWithTags) => EntryWithTags
  ): DemoState => ({
    ...state,
    entries: state.entries.map((entry) => (match(entry) ? patch(entry) : entry)),
  })

  const actions: VitrineActions = {
    // -----------------------------------------------------------------------
    // Pastas das Coleções
    // -----------------------------------------------------------------------
    async createFolder(input): Result<{ id: string }> {
      const parsed = createFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const { name, parentFolderId } = parsed.data
      if (parentFolderId && !state.folders.some((folder) => folder.id === parentFolderId)) {
        return no(GONE)
      }
      const id = newId()
      commit({
        ...state,
        folders: [
          ...state.folders,
          {
            id,
            owner_id: DEMO_OWNER_ID,
            name,
            parent_folder_id: parentFolderId,
            display_order: nextDisplayOrder(
              state.folders.filter((folder) => folder.parent_folder_id === parentFolderId)
            ),
            created_at: now(),
          },
        ],
      })
      return ok({ id })
    },

    async renameFolder(input): Result {
      const parsed = renameFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      if (!state.folders.some((folder) => folder.id === parsed.data.id)) return no(GONE)
      commit({
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === parsed.data.id ? { ...folder, name: parsed.data.name } : folder
        ),
      })
      return ok()
    },

    async moveFolder(input): Result {
      const parsed = moveFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const { id, targetFolderId } = parsed.data
      if (targetFolderId === id) return no("Uma pasta não pode ir para dentro dela mesma.")
      const state = get()
      if (targetFolderId && descendantFolderIds(state.folders, id).has(targetFolderId)) {
        return no("Uma pasta não pode ir para dentro de uma subpasta dela.")
      }
      commit({
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === id ? { ...folder, parent_folder_id: targetFolderId } : folder
        ),
      })
      return ok()
    },

    async deleteFolder(input): Result {
      const parsed = idSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      // Mesma cascata do banco: subpastas, categorias delas e itens.
      const doomed = descendantFolderIds(state.folders, parsed.data.id)
      doomed.add(parsed.data.id)
      const doomedCategories = new Set(
        state.categories
          .filter((category) => category.folder_id && doomed.has(category.folder_id))
          .map((category) => category.id)
      )
      commit(
        withoutCategories(
          { ...state, folders: state.folders.filter((folder) => !doomed.has(folder.id)) },
          doomedCategories
        )
      )
      return ok()
    },

    async reorderLevel(input): Result {
      const parsed = reorderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const position = new Map(parsed.data.items.map((item, index) => [item.id, index]))
      const state = get()
      commit({
        ...state,
        folders: state.folders.map((folder) =>
          position.has(folder.id) ? { ...folder, display_order: position.get(folder.id)! } : folder
        ),
        categories: state.categories.map((category) =>
          position.has(category.id)
            ? { ...category, display_order: position.get(category.id)! }
            : category
        ),
      })
      return ok()
    },

    // -----------------------------------------------------------------------
    // Categorias
    // -----------------------------------------------------------------------
    async createCategory(input): Result<{ id: string }> {
      const parsed = createCategorySchema.safeParse({
        ...input,
        estrutura: parseEstrutura(input.estrutura),
      })
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const { name, icon, color, folderId, estrutura } = parsed.data
      if (state.categories.some((category) => category.name === name)) {
        return no("Você já tem uma categoria com esse nome.")
      }
      if (folderId && !state.folders.some((folder) => folder.id === folderId)) return no(GONE)
      const id = newId()
      commit({
        ...state,
        categories: [
          ...state.categories,
          {
            id,
            owner_id: DEMO_OWNER_ID,
            name,
            icon: icon || null,
            color: normalizeCategoryColor(color),
            folder_id: folderId,
            display_order: nextDisplayOrder(
              state.categories.filter((category) => category.folder_id === folderId)
            ),
            estrutura,
            created_at: now(),
          },
        ],
      })
      return ok({ id })
    },

    async updateCategory(input): Result {
      const parsed = updateCategorySchema.safeParse({
        ...input,
        estrutura: parseEstrutura(input.estrutura),
      })
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const { id, name, icon, color, estrutura, removedFieldIds = [] } = parsed.data
      if (!state.categories.some((category) => category.id === id)) return no(GONE)
      if (state.categories.some((category) => category.id !== id && category.name === name)) {
        return no("Você já tem uma categoria com esse nome.")
      }
      let next: DemoState = {
        ...state,
        categories: state.categories.map((category) =>
          category.id === id
            ? { ...category, name, icon: icon || null, color: normalizeCategoryColor(color), estrutura }
            : category
        ),
      }
      // Campo removido: o valor sai de fato de todos os itens da categoria.
      if (removedFieldIds.length > 0) {
        next = updateEntries(
          next,
          (entry) => entry.category_id === id,
          (entry) => {
            const custom: CustomFields = { ...entry.custom_fields }
            for (const fieldId of removedFieldIds) delete custom[fieldId]
            return { ...entry, custom_fields: custom }
          }
        )
      }
      commit(next)
      return ok()
    },

    async moveCategory(input): Result {
      const parsed = moveFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      commit({
        ...state,
        categories: state.categories.map((category) =>
          category.id === parsed.data.id
            ? { ...category, folder_id: parsed.data.targetFolderId }
            : category
        ),
      })
      return ok()
    },

    async deleteCategory(input): Result {
      const parsed = idSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      commit(withoutCategories(get(), new Set([parsed.data.id])))
      return ok()
    },

    async structureImpact(input): Result<StructureImpact> {
      const parsed = structureImpactSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const entries = get().entries.filter((entry) => entry.category_id === parsed.data.categoryId)
      const filled: Record<string, number> = {}
      for (const fieldId of parsed.data.fieldIds) {
        filled[fieldId] = entries.filter((entry) => {
          const value = entry.custom_fields[fieldId]
          return value !== undefined && value !== null
        }).length
      }
      const optionUsage: Record<string, Record<string, number>> = {}
      for (const { fieldId, options } of parsed.data.fieldOptions ?? []) {
        optionUsage[fieldId] = {}
        for (const option of options) {
          optionUsage[fieldId][option] = entries.filter(
            (entry) => String(entry.custom_fields[fieldId] ?? "") === option
          ).length
        }
      }
      return ok({ total: entries.length, filled, optionUsage })
    },

    // -----------------------------------------------------------------------
    // Subpastas de uma categoria
    // -----------------------------------------------------------------------
    async createEntryFolder(input): Result<{ id: string }> {
      const parsed = createEntryFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const { categoryId, name, parentFolderId } = parsed.data
      if (!state.categories.some((category) => category.id === categoryId)) return no(GONE)
      if (
        parentFolderId &&
        !state.entryFolders.some(
          (folder) => folder.id === parentFolderId && folder.category_id === categoryId
        )
      ) {
        return no(GONE)
      }
      const id = newId()
      commit({
        ...state,
        entryFolders: [
          ...state.entryFolders,
          {
            id,
            owner_id: DEMO_OWNER_ID,
            category_id: categoryId,
            name,
            parent_folder_id: parentFolderId,
            display_order: 0,
            created_at: now(),
          },
        ],
      })
      return ok({ id })
    },

    async renameEntryFolder(input): Result {
      const parsed = renameFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      if (!state.entryFolders.some((folder) => folder.id === parsed.data.id)) return no(GONE)
      commit({
        ...state,
        entryFolders: state.entryFolders.map((folder) =>
          folder.id === parsed.data.id ? { ...folder, name: parsed.data.name } : folder
        ),
      })
      return ok()
    },

    async moveEntryFolder(input): Result {
      const parsed = moveFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const { id, targetFolderId } = parsed.data
      if (targetFolderId === id) return no("Uma pasta não pode ir para dentro dela mesma.")
      const state = get()
      const folder = state.entryFolders.find((item) => item.id === id)
      if (!folder) return no(GONE)
      const siblings = state.entryFolders.filter((item) => item.category_id === folder.category_id)
      if (targetFolderId) {
        if (!siblings.some((item) => item.id === targetFolderId)) return no(GONE)
        if (descendantFolderIds(siblings, id).has(targetFolderId)) {
          return no("Uma pasta não pode ir para dentro de uma subpasta dela.")
        }
      }
      commit({
        ...state,
        entryFolders: state.entryFolders.map((item) =>
          item.id === id ? { ...item, parent_folder_id: targetFolderId } : item
        ),
      })
      return ok()
    },

    async deleteEntryFolder(input): Result {
      const parsed = deleteEntryFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const folder = state.entryFolders.find((item) => item.id === parsed.data.id)
      if (!folder) return no(GONE)

      if (parsed.data.keepContents) {
        // Subpastas e itens sobem um nível; só a pasta some.
        const parent = folder.parent_folder_id
        commit({
          ...state,
          entryFolders: state.entryFolders
            .filter((item) => item.id !== folder.id)
            .map((item) =>
              item.parent_folder_id === folder.id ? { ...item, parent_folder_id: parent } : item
            ),
          entries: state.entries.map((entry) =>
            entry.folder_id === folder.id ? { ...entry, folder_id: parent } : entry
          ),
        })
        return ok()
      }

      const doomed = folderSubtree(
        state.entryFolders.filter((item) => item.category_id === folder.category_id),
        folder.id
      )
      commit({
        ...state,
        entryFolders: state.entryFolders.filter((item) => !doomed.has(item.id)),
        entries: state.entries.filter((entry) => !(entry.folder_id && doomed.has(entry.folder_id))),
      })
      return ok()
    },

    async moveEntriesToFolder(input): Result {
      const parsed = moveEntriesToFolderSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const { ids, categoryId, folderId } = parsed.data
      const state = get()
      if (
        folderId &&
        !state.entryFolders.some(
          (folder) => folder.id === folderId && folder.category_id === categoryId
        )
      ) {
        return no(GONE)
      }
      const wanted = new Set(ids)
      commit(
        updateEntries(
          state,
          (entry) => wanted.has(entry.id) && entry.category_id === categoryId,
          (entry) => ({ ...entry, folder_id: folderId, updated_at: now() })
        )
      )
      return ok()
    },

    // -----------------------------------------------------------------------
    // Itens
    // -----------------------------------------------------------------------
    async createEntry(input): Result<{ id: string }> {
      const parsed = entrySchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const data = parsed.data
      const category = state.categories.find((item) => item.id === data.categoryId)
      if (!category) return no(GONE)
      const folderId = data.folderId ?? null
      if (
        folderId &&
        !state.entryFolders.some(
          (folder) => folder.id === folderId && folder.category_id === category.id
        )
      ) {
        return no(GONE)
      }
      const knownTags = new Set(state.tags.map((tag) => tag.id))
      const id = newId()
      const stamp = now()
      commit({
        ...state,
        entries: [
          ...state.entries,
          {
            id,
            category_id: category.id,
            folder_id: folderId,
            owner_id: DEMO_OWNER_ID,
            name: data.name,
            rating: normalizeRating(data.rating),
            image_url: data.imageUrl || null,
            image_display: data.imageDisplay,
            custom_fields: coerceCustomFields(category.estrutura, data.customFields),
            created_at: stamp,
            updated_at: stamp,
            entry_tags: [...new Set(data.tagIds)]
              .filter((tagId) => knownTags.has(tagId))
              .map((tagId) => ({ tag_id: tagId })),
          },
        ],
      })
      return ok({ id })
    },

    async updateEntry(input): Result {
      const parsed = updateEntrySchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const data = parsed.data
      const current = state.entries.find((entry) => entry.id === data.id)
      const category = state.categories.find((item) => item.id === data.categoryId)
      if (!current || !category) return no(GONE)
      if (
        data.folderId &&
        !state.entryFolders.some(
          (folder) => folder.id === data.folderId && folder.category_id === category.id
        )
      ) {
        return no(GONE)
      }
      const knownTags = new Set(state.tags.map((tag) => tag.id))
      commit(
        updateEntries(
          state,
          (entry) => entry.id === data.id,
          (entry) => ({
            ...entry,
            name: data.name,
            rating: normalizeRating(data.rating),
            image_url: data.imageUrl || null,
            image_display: data.imageDisplay,
            custom_fields: coerceCustomFields(category.estrutura, data.customFields),
            folder_id: data.folderId !== undefined ? data.folderId : entry.folder_id,
            updated_at: now(),
            entry_tags: [...new Set(data.tagIds)]
              .filter((tagId) => knownTags.has(tagId))
              .map((tagId) => ({ tag_id: tagId })),
          })
        )
      )
      return ok()
    },

    async deleteEntry(input): Result {
      const parsed = deleteEntrySchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      commit({ ...state, entries: state.entries.filter((entry) => entry.id !== parsed.data.id) })
      return ok()
    },

    async bulkDeleteEntries(input): Result {
      const parsed = bulkSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const doomed = new Set(parsed.data.ids)
      const state = get()
      commit({ ...state, entries: state.entries.filter((entry) => !doomed.has(entry.id)) })
      return ok()
    },

    async bulkTag(input): Result {
      const parsed = bulkTagSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const { ids, tagId, mode } = parsed.data
      const state = get()
      if (!state.tags.some((tag) => tag.id === tagId)) return no(GONE)
      const wanted = new Set(ids)
      commit(
        updateEntries(
          state,
          (entry) => wanted.has(entry.id),
          (entry) => {
            const has = entry.entry_tags.some((link) => link.tag_id === tagId)
            if (mode === "add") {
              return has ? entry : { ...entry, entry_tags: [...entry.entry_tags, { tag_id: tagId }] }
            }
            return { ...entry, entry_tags: entry.entry_tags.filter((link) => link.tag_id !== tagId) }
          }
        )
      )
      return ok()
    },

    async movePreview(input): Result<MovePreview> {
      const parsed = bulkMoveSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const from = state.categories.find((item) => item.id === parsed.data.categoryId)
      const to = state.categories.find((item) => item.id === parsed.data.toCategoryId)
      if (!from || !to) return no(GONE)
      const wanted = new Set(parsed.data.ids)
      let dropped = 0
      let kept = 0
      for (const entry of state.entries) {
        if (!wanted.has(entry.id)) continue
        const result = migrateCustomFields(from.estrutura, to.estrutura, entry.custom_fields)
        dropped += result.dropped
        kept += result.kept
      }
      return ok({ dropped, kept })
    },

    async bulkMoveEntries(input): Result {
      const parsed = bulkMoveSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const from = state.categories.find((item) => item.id === parsed.data.categoryId)
      const to = state.categories.find((item) => item.id === parsed.data.toCategoryId)
      if (!from || !to) return no(GONE)
      const wanted = new Set(parsed.data.ids)
      // Mesma regra do app: valor migra por nome+tipo; o item chega na raiz
      // do destino (as subpastas são da categoria de origem).
      commit(
        updateEntries(
          state,
          (entry) => wanted.has(entry.id),
          (entry) => ({
            ...entry,
            category_id: to.id,
            folder_id: null,
            custom_fields: migrateCustomFields(from.estrutura, to.estrutura, entry.custom_fields)
              .values,
            updated_at: now(),
          })
        )
      )
      return ok()
    },

    // -----------------------------------------------------------------------
    // Tags — na demo, são só desta visita
    // -----------------------------------------------------------------------
    async createTag(input): Result<Tag> {
      const parsed = tagSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const name = parsed.data.name
      if (state.tags.some((tag) => normalizeName(tag.name) === normalizeName(name))) {
        return no("Já existe uma tag com esse nome.")
      }
      const tag: Tag = { id: newId(), name, color: normalizeTagColor(parsed.data.color) }
      commit({ ...state, tags: [...state.tags, tag] })
      return ok(tag)
    },

    async updateTag(input): Result {
      const parsed = updateTagSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const { id, name, color } = parsed.data
      if (!state.tags.some((tag) => tag.id === id)) return no(GONE)
      if (
        state.tags.some((tag) => tag.id !== id && normalizeName(tag.name) === normalizeName(name))
      ) {
        return no("Já existe uma tag com esse nome.")
      }
      commit({
        ...state,
        tags: state.tags.map((tag) =>
          tag.id === id ? { ...tag, name, color: normalizeTagColor(color) } : tag
        ),
      })
      return ok()
    },

    async deleteTag(input): Result {
      const parsed = idSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const tagId = parsed.data.id
      const state = get()
      // Os itens ficam; só perdem a tag.
      commit({
        ...state,
        tags: state.tags.filter((tag) => tag.id !== tagId),
        entries: state.entries.map((entry) =>
          entry.entry_tags.some((link) => link.tag_id === tagId)
            ? { ...entry, entry_tags: entry.entry_tags.filter((link) => link.tag_id !== tagId) }
            : entry
        ),
      })
      return ok()
    },

    async searchEntriesForTag(input): Result<EntryPickerRow[]> {
      const parsed = searchEntriesForTagSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const state = get()
      const search = parsed.data.query.trim().toLowerCase()
      const categoryById = new Map(state.categories.map((category) => [category.id, category]))
      const rows: EntryPickerRow[] = []
      for (const entry of state.entries) {
        const category = categoryById.get(entry.category_id)
        if (!category) continue
        if (search && !entry.name.toLowerCase().includes(search)) continue
        rows.push({
          id: entry.id,
          name: entry.name,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          hasTag: entry.entry_tags.some((link) => link.tag_id === parsed.data.tagId),
        })
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      return ok(rows.slice(0, 100))
    },

    async applyTagToEntries(input): Result {
      const parsed = applyTagSchema.safeParse(input)
      if (!parsed.success) return failValidation(parsed.error.issues)
      const { tagId, ids } = parsed.data
      const state = get()
      if (!state.tags.some((tag) => tag.id === tagId)) return no(GONE)
      const wanted = new Set(ids)
      commit(
        updateEntries(
          state,
          (entry) => wanted.has(entry.id) && !entry.entry_tags.some((link) => link.tag_id === tagId),
          (entry) => ({ ...entry, entry_tags: [...entry.entry_tags, { tag_id: tagId }] })
        )
      )
      return ok()
    },
  }

  return actions
}
