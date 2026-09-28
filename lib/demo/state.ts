/**
 * O acervo da demonstração: as mesmas linhas que o Supabase devolveria
 * (`Folder`, `Category`, `EntryFolder`, `EntryWithTags`, `Tag`), só que
 * vivendo na memória do navegador.
 *
 * TypeScript puro, sem React: é o que `store.ts` transforma e o que os
 * testes conferem.
 */
import type { ParsedBackupPayload } from "@/lib/backup/import"
import { coerceCustomFields, normalizeName, parseEstrutura } from "@/lib/domain/fields"
import { normalizeCategoryColor, normalizeTagColor } from "@/lib/domain/tags"
import type {
  Category,
  EntryFolder,
  EntryWithTags,
  Folder,
  Profile,
  Tag,
} from "@/lib/domain/types"
import { imageDisplayOf } from "@/lib/domain/view"

export interface DemoState {
  folders: Folder[]
  categories: Category[]
  entryFolders: EntryFolder[]
  entries: EntryWithTags[]
  tags: Tag[]
}

/** Data fixa do seed: o HTML do servidor e o do navegador saem idênticos. */
const SEED_DATE = "2026-09-24T12:00:00.000Z"

function hash32(text: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

/**
 * Um UUID DETERMINÍSTICO a partir de uma chave do seed. Precisa ser
 * determinístico por dois motivos: o HTML do servidor e o do navegador têm de
 * bater (hidratação), e um F5 em `/demo/categoria/<id>` precisa achar a mesma
 * categoria de novo. Formato v4 (versão 4, variante 10xx) para passar no
 * `z.uuid()` dos mesmos schemas que validam o app de verdade.
 */
export function demoId(key: string): string {
  const hex = [0, 1, 2, 3]
    .map((part) => hash32(key, Math.imul(part + 1, 0x9e3779b9)).toString(16).padStart(8, "0"))
    .join("")
  const variant = ((parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Id de tudo que o visitante cria durante a visita. */
export function randomDemoId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  return demoId(`${Date.now()}-${Math.random()}`)
}

export const DEMO_OWNER_ID = demoId("visitante")

export const DEMO_PROFILE: Profile = {
  id: DEMO_OWNER_ID,
  username: "visitante",
  display_name: "Visitante",
  avatar_url: null,
  created_at: SEED_DATE,
}

function normalizeSeedRating(rating: number | null): number | null {
  if (rating === null || !Number.isFinite(rating)) return null
  const value = Math.min(5, Math.max(0, Math.round(rating * 2) / 2))
  return value === 0 ? null : value
}

/**
 * O seed (formato de backup) virando linhas. Mesmas regras de
 * `performImport`: estrutura lida com tolerância, valores coagidos ao tipo do
 * campo, cor fora da paleta descartada, tag casada pelo nome.
 */
export function buildDemoState(seed: ParsedBackupPayload): DemoState {
  const base = Date.parse(SEED_DATE)
  const at = (hoursAgo: number) => new Date(base - hoursAgo * 3_600_000).toISOString()

  const folders: Folder[] = seed.folders.map((folder, index) => ({
    id: demoId(`pasta:${folder.id}`),
    owner_id: DEMO_OWNER_ID,
    name: folder.name,
    parent_folder_id: folder.parentId ? demoId(`pasta:${folder.parentId}`) : null,
    display_order: index,
    created_at: SEED_DATE,
  }))

  const categories: Category[] = seed.categories.map((category, index) => ({
    id: demoId(`categoria:${category.id}`),
    owner_id: DEMO_OWNER_ID,
    name: category.name,
    icon: category.icon,
    color: normalizeCategoryColor(category.color),
    folder_id: category.folderId ? demoId(`pasta:${category.folderId}`) : null,
    display_order: index,
    estrutura: parseEstrutura(category.estrutura),
    created_at: SEED_DATE,
  }))
  const estruturaBySeedId = new Map(
    seed.categories.map((category, index) => [category.id, categories[index].estrutura])
  )

  const entryFolders: EntryFolder[] = seed.entryFolders.map((folder) => ({
    id: demoId(`subpasta:${folder.id}`),
    owner_id: DEMO_OWNER_ID,
    category_id: demoId(`categoria:${folder.categoryId}`),
    name: folder.name,
    parent_folder_id: folder.parentId ? demoId(`subpasta:${folder.parentId}`) : null,
    display_order: 0,
    created_at: SEED_DATE,
  }))

  const tagsByName = new Map<string, Tag>()
  for (const entry of seed.entries) {
    for (const tag of entry.tags) {
      const key = normalizeName(tag.name)
      if (!tagsByName.has(key)) {
        tagsByName.set(key, {
          id: demoId(`tag:${key}`),
          name: tag.name.trim(),
          color: normalizeTagColor(tag.color),
        })
      }
    }
  }

  const entries: EntryWithTags[] = seed.entries.map((entry, index) => {
    const tagIds = [
      ...new Set(
        entry.tags
          .map((tag) => tagsByName.get(normalizeName(tag.name))?.id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const createdAt = at(index)
    return {
      id: demoId(`item:${index}:${entry.name}`),
      category_id: demoId(`categoria:${entry.categoryId}`),
      folder_id: entry.folderId ? demoId(`subpasta:${entry.folderId}`) : null,
      owner_id: DEMO_OWNER_ID,
      name: entry.name.trim(),
      rating: normalizeSeedRating(entry.rating),
      image_url: entry.imageUrl?.trim() || null,
      image_display: imageDisplayOf(entry.imageDisplay),
      custom_fields: coerceCustomFields(
        estruturaBySeedId.get(entry.categoryId) ?? [],
        entry.customFields
      ),
      created_at: createdAt,
      updated_at: createdAt,
      entry_tags: tagIds.map((tagId) => ({ tag_id: tagId })),
    }
  })

  return {
    folders,
    categories,
    entryFolders,
    entries,
    tags: [...tagsByName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  }
}

/** Quantos itens cada categoria tem — o que a view `category_entry_counts` daria. */
export function demoCounts(state: DemoState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of state.entries) {
    counts[entry.category_id] = (counts[entry.category_id] ?? 0) + 1
  }
  return counts
}
