/**
 * O formato de backup (exportar/importar o acervo inteiro) e a lógica de
 * gravação — compartilhada entre a Server Action de importar
 * (`app/configuracoes/actions.ts`) e a semeadura/reset da conta demo
 * (`app/demo/*`). Não é "use server": é chamado tanto de dentro de uma Server
 * Action quanto de uma Route Handler, com clientes Supabase diferentes (o do
 * cookie da sessão, ou o admin/`service_role` da conta demo).
 */
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import { ok, fail, type ActionResult } from "@/lib/actions/result"
import { coerceCustomFields, normalizeName, parseEstrutura } from "@/lib/domain/fields"
import { normalizeCategoryColor, normalizeTagColor } from "@/lib/domain/tags"
import { FIELD_TYPES, type CustomFields, type Estrutura } from "@/lib/domain/types"
import { imageDisplayOf } from "@/lib/domain/view"

export interface BackupFolder {
  id: string
  name: string
  parentId: string | null
}

export interface BackupCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  folderId: string | null
  estrutura: Estrutura
}

export interface BackupEntry {
  categoryId: string
  name: string
  rating: number | null
  imageUrl: string | null
  imageDisplay: { x: number; y: number; zoom: number }
  customFields: CustomFields
  tags: { name: string; color: string }[]
}

export interface BackupPayload {
  version: 1
  exportedAt: string
  folders: BackupFolder[]
  categories: BackupCategory[]
  entries: BackupEntry[]
}

const backupFieldSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.enum(FIELD_TYPES),
  opcoes: z.array(z.string()).optional(),
})

const backupFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
})

const backupCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  icon: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  folderId: z.string().nullable().default(null),
  estrutura: z.array(backupFieldSchema).default([]),
})

const backupEntrySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1),
  rating: z.number().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  imageDisplay: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).partial().default({}),
  customFields: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  tags: z
    .array(z.object({ name: z.string().trim().min(1), color: z.string().nullable().default(null) }))
    .default([]),
})

export const backupPayloadSchema = z.object({
  folders: z.array(backupFolderSchema).default([]),
  categories: z.array(backupCategorySchema).min(1, "O arquivo não tem nenhuma categoria."),
  entries: z.array(backupEntrySchema).default([]),
})

export type ParsedBackupPayload = z.infer<typeof backupPayloadSchema>

export type ParseBackupResult =
  | { ok: true; data: ParsedBackupPayload }
  | { ok: false; error: string }

/** JSON cru (texto colado ou lido de um arquivo) → payload validado. */
export function parseBackupJSON(json: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: "JSON inválido. Confira se colou o arquivo inteiro." }
  }

  const parsed = backupPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "JSON fora do formato esperado." }
  }

  const { folders, categories, entries } = parsed.data

  const folderIds = new Set(folders.map((folder) => folder.id))
  for (const folder of folders) {
    if (folder.parentId !== null && !folderIds.has(folder.parentId)) {
      return { ok: false, error: `Pasta "${folder.name}": a pasta-mãe não existe no arquivo.` }
    }
  }
  const categoryIds = new Set(categories.map((category) => category.id))
  for (const category of categories) {
    if (category.folderId !== null && !folderIds.has(category.folderId)) {
      return { ok: false, error: `Categoria "${category.name}": a pasta não existe no arquivo.` }
    }
  }
  for (const entry of entries) {
    if (!categoryIds.has(entry.categoryId)) {
      return { ok: false, error: `Item "${entry.name}": a categoria não existe no arquivo.` }
    }
  }

  return { ok: true, data: parsed.data }
}

/** Meia estrela: a nota só existe em passos de 0,5 — mesma regra do formulário de item. */
function normalizeImportRating(rating: number | null): number | null {
  if (rating === null || !Number.isFinite(rating)) return null
  const value = Math.min(5, Math.max(0, Math.round(rating * 2) / 2))
  return value === 0 ? null : value
}

export interface ImportSummary {
  folders: number
  categories: number
  entries: number
  /** Categoria cujo nome colidiu com uma já existente e ganhou um sufixo. */
  renamed: { from: string; to: string }[]
}

/**
 * Apaga tudo que `ownerId` tem — pastas (cascateia categorias e itens) e
 * qualquer categoria órfã de pasta. Não toca em tags: são vocabulário
 * compartilhado do grupo, e `on delete cascade` de `entry_tags` já solta os
 * vínculos quando os itens somem.
 */
export async function wipeOwnerData(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ActionResult> {
  const [foldersResult, categoriesResult] = await Promise.all([
    supabase.from("folders").delete().eq("owner_id", ownerId),
    supabase.from("categories").delete().eq("owner_id", ownerId),
  ])
  if (foldersResult.error) return fail(foldersResult.error)
  if (categoriesResult.error) return fail(categoriesResult.error)
  return ok()
}

/**
 * Grava um payload validado em nome de `ownerId`. Sempre cria estrutura
 * nova — nunca mistura com o que já existe. Categoria com nome repetido
 * ganha um sufixo (a tabela tem `unique(owner_id, name)`); pasta não tem essa
 * trava. Tag casa por nome com o vocabulário já compartilhado do grupo; a que
 * não existir ainda é criada.
 *
 * `supabase` tanto pode ser o cliente da sessão (respeitando RLS, para quem
 * está autenticado como `ownerId`) quanto o cliente admin/`service_role`
 * (ignora RLS, usado só na primeira semeadura da conta demo).
 */
export async function performImport(
  supabase: SupabaseClient,
  ownerId: string,
  payload: ParsedBackupPayload
): Promise<ActionResult<ImportSummary>> {
  const { folders, categories, entries } = payload

  // 1) pastas, em ondas: só insere quem já tem a mãe resolvida (ou não tem mãe).
  const folderIdMap = new Map<string, string>()
  let pending = [...folders]
  let guard = 0
  while (pending.length > 0) {
    guard += 1
    if (guard > folders.length + 1) {
      return { ok: false, error: "As pastas do arquivo formam um ciclo entre si." }
    }
    const ready = pending.filter(
      (folder) => folder.parentId === null || folderIdMap.has(folder.parentId)
    )
    if (ready.length === 0) {
      return { ok: false, error: "As pastas do arquivo formam um ciclo entre si." }
    }

    const results = await Promise.all(
      ready.map((folder) =>
        supabase
          .from("folders")
          .insert({
            owner_id: ownerId,
            name: folder.name,
            parent_folder_id: folder.parentId ? (folderIdMap.get(folder.parentId) ?? null) : null,
            // Ordem exata não importa aqui: cai no fim da lista e dá para arrastar depois.
            display_order: 9999,
          })
          .select("id")
          .single()
      )
    )
    const failed = results.find((result) => result.error)
    if (failed?.error) return fail(failed.error)
    results.forEach((result, index) => {
      folderIdMap.set(ready[index].id, (result.data as { id: string }).id)
    })

    pending = pending.filter((folder) => !ready.includes(folder))
  }

  // 2) categorias — nome que já existe ganha um sufixo, uma de cada vez (o
  // conjunto de nomes usados precisa estar atualizado a cada iteração).
  const { data: existingCategories, error: existingError } = await supabase
    .from("categories")
    .select("name")
    .eq("owner_id", ownerId)
  if (existingError) return fail(existingError)

  const usedNames = new Set(
    ((existingCategories ?? []) as { name: string }[]).map((row) => row.name.toLowerCase())
  )
  const renamed: { from: string; to: string }[] = []

  function uniqueCategoryName(base: string): string {
    let candidate = base
    let suffix = 2
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${base} (${suffix})`
      suffix += 1
    }
    usedNames.add(candidate.toLowerCase())
    if (candidate !== base) renamed.push({ from: base, to: candidate })
    return candidate
  }

  const categoryIdMap = new Map<string, string>()
  const estruturaById = new Map<string, Estrutura>()

  for (const category of categories) {
    const estrutura = parseEstrutura(category.estrutura)
    const { data, error } = await supabase
      .from("categories")
      .insert({
        owner_id: ownerId,
        name: uniqueCategoryName(category.name.trim()),
        icon: category.icon?.trim() || null,
        color: normalizeCategoryColor(category.color),
        folder_id: category.folderId ? (folderIdMap.get(category.folderId) ?? null) : null,
        estrutura,
        display_order: 9999,
      })
      .select("id")
      .single()

    if (error) return fail(error)
    categoryIdMap.set(category.id, (data as { id: string }).id)
    estruturaById.set(category.id, estrutura)
  }

  // 3) tags — casa pelo nome com o vocabulário já compartilhado do grupo;
  // o resto é criado (com a cor que veio no arquivo, ou o roxo padrão).
  const { data: existingTags, error: tagsError } = await supabase.from("tags").select("id, name")
  if (tagsError) return fail(tagsError)

  const tagIdByName = new Map<string, string>()
  for (const tag of (existingTags ?? []) as { id: string; name: string }[]) {
    tagIdByName.set(normalizeName(tag.name), tag.id)
  }

  const newTags = new Map<string, { name: string; color: string }>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const key = normalizeName(tag.name)
      if (tagIdByName.has(key) || newTags.has(key)) continue
      newTags.set(key, { name: tag.name.trim(), color: normalizeTagColor(tag.color) })
    }
  }

  if (newTags.size > 0) {
    const { data, error } = await supabase
      .from("tags")
      .insert([...newTags.values()])
      .select("id, name")
    if (error) return fail(error)
    for (const row of (data ?? []) as { id: string; name: string }[]) {
      tagIdByName.set(normalizeName(row.name), row.id)
    }
  }

  // 4) itens, um insert por item — precisa do id de volta pareado 1:1 para
  // gravar os vínculos de tag, e um `.insert([...]).select()` em lote não
  // garante a ordem de retorno igual à de entrada.
  const entryResults = await Promise.all(
    entries.map((entry) =>
      supabase
        .from("entries")
        .insert({
          category_id: categoryIdMap.get(entry.categoryId)!,
          owner_id: ownerId,
          name: entry.name.trim(),
          rating: normalizeImportRating(entry.rating),
          image_url: entry.imageUrl?.trim() || null,
          image_display: imageDisplayOf(entry.imageDisplay),
          custom_fields: coerceCustomFields(
            estruturaById.get(entry.categoryId) ?? [],
            entry.customFields
          ),
        })
        .select("id")
        .single()
    )
  )
  const failedEntry = entryResults.find((result) => result.error)
  if (failedEntry?.error) return fail(failedEntry.error)

  const tagLinks: { entry_id: string; tag_id: string }[] = []
  entries.forEach((entry, index) => {
    const entryId = (entryResults[index].data as { id: string } | null)?.id
    if (!entryId) return
    const seen = new Set<string>()
    for (const tag of entry.tags) {
      const tagId = tagIdByName.get(normalizeName(tag.name))
      if (tagId && !seen.has(tagId)) {
        seen.add(tagId)
        tagLinks.push({ entry_id: entryId, tag_id: tagId })
      }
    }
  })

  if (tagLinks.length > 0) {
    const { error: linkError } = await supabase.from("entry_tags").insert(tagLinks)
    if (linkError) return fail(linkError)
  }

  return ok({
    folders: folderIdMap.size,
    categories: categoryIdMap.size,
    entries: entries.length,
    renamed,
  })
}
