"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  parseBackupJSON,
  performImport,
  type BackupCategory,
  type BackupEntry,
  type BackupEntryFolder,
  type BackupFolder,
  type BackupPayload,
  type ImportSummary,
} from "@/lib/backup/import"
import { parseCustomFields, parseEstrutura } from "@/lib/domain/fields"
import { normalizeSort } from "@/lib/domain/filter"
import { imageDisplayOf } from "@/lib/domain/view"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

const profileSchema = z.object({
  displayName: z.string().trim().max(80, "Nome muito longo."),
  username: z
    .string()
    .trim()
    .min(3, "O nome de usuário precisa de pelo menos 3 caracteres.")
    .max(30, "Nome de usuário muito longo.")
    .regex(/^[a-z0-9_]+$/, "Use só letras minúsculas, números e _."),
  avatarUrl: z.string().trim().max(2048).nullable(),
})

export async function updateProfileAction(input: {
  displayName: string
  username: string
  avatarUrl: string | null
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    ...input,
    username: input.username.trim().toLowerCase(),
  })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      username: parsed.data.username,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", user.id)

  if (error) return fail(error)

  revalidatePath("/", "layout")
  return ok()
}

// ---------------------------------------------------------------------------
// Backup: exportar e importar o acervo inteiro (pastas, categorias, itens e
// as tags que os itens usam). Formato pensado para dar para escrever à mão:
// os `id` aqui são só chaves de referência DENTRO do arquivo — a importação
// sempre cria linhas novas, nunca reaproveita um id de verdade do banco.
// ---------------------------------------------------------------------------

export async function exportCollectionAction(): Promise<ActionResult<BackupPayload>> {
  const user = await requireUser()
  const supabase = await createClient()

  const [foldersResult, categoriesResult, entryFoldersResult, entriesResult, tagsResult] =
    await Promise.all([
      supabase.from("folders").select("id, name, parent_folder_id").eq("owner_id", user.id),
      supabase
        .from("categories")
        .select("id, name, icon, color, folder_id, estrutura, rating_enabled, default_sort")
        .eq("owner_id", user.id),
      // A ordem de exportação É a ordem manual: o import a reconstrói.
      supabase
        .from("entry_folders")
        .select("id, category_id, name, parent_folder_id")
        .eq("owner_id", user.id)
        .order("display_order", { ascending: true }),
      supabase
        .from("entries")
        .select(
          "id, category_id, folder_id, name, rating, image_url, image_display, custom_fields, entry_tags(tag_id)"
        )
        .eq("owner_id", user.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("tags").select("id, name, color"),
    ])

  if (foldersResult.error) return fail(foldersResult.error)
  if (entryFoldersResult.error) return fail(entryFoldersResult.error)
  if (categoriesResult.error) return fail(categoriesResult.error)
  if (entriesResult.error) return fail(entriesResult.error)
  if (tagsResult.error) return fail(tagsResult.error)

  const tagById = new Map(
    ((tagsResult.data ?? []) as { id: string; name: string; color: string }[]).map((tag) => [
      tag.id,
      tag,
    ])
  )

  const folders: BackupFolder[] = (
    (foldersResult.data ?? []) as { id: string; name: string; parent_folder_id: string | null }[]
  ).map((row) => ({ id: row.id, name: row.name, parentId: row.parent_folder_id }))

  const categories: BackupCategory[] = (
    (categoriesResult.data ?? []) as {
      id: string
      name: string
      icon: string | null
      color: string | null
      folder_id: string | null
      estrutura: unknown
      rating_enabled: boolean | null
      default_sort: string | null
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    folderId: row.folder_id,
    estrutura: parseEstrutura(row.estrutura),
    ratingEnabled: row.rating_enabled !== false,
    defaultSort: normalizeSort(row.default_sort, row.rating_enabled !== false),
  }))

  const entryFolders: BackupEntryFolder[] = (
    (entryFoldersResult.data ?? []) as {
      id: string
      category_id: string
      name: string
      parent_folder_id: string | null
    }[]
  ).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    parentId: row.parent_folder_id,
  }))

  const entries: BackupEntry[] = (
    (entriesResult.data ?? []) as {
      category_id: string
      folder_id: string | null
      name: string
      rating: number | null
      image_url: string | null
      image_display: unknown
      custom_fields: unknown
      entry_tags: { tag_id: string }[] | null
    }[]
  ).map((row) => ({
    categoryId: row.category_id,
    folderId: row.folder_id,
    name: row.name,
    rating: row.rating,
    imageUrl: row.image_url,
    imageDisplay: imageDisplayOf(row.image_display),
    customFields: parseCustomFields(row.custom_fields),
    tags: (row.entry_tags ?? [])
      .map((link) => tagById.get(link.tag_id))
      .filter((tag): tag is { id: string; name: string; color: string } => Boolean(tag))
      .map((tag) => ({ name: tag.name, color: tag.color })),
  }))

  return ok({
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    categories,
    entryFolders,
    entries,
  })
}

/**
 * Importa sempre criando estrutura nova — nunca mistura com o que já existe.
 * A validação e a gravação em si vivem em `lib/backup/import.ts`; a validação
 * também lê o acervo de exemplo da demonstração (`lib/demo/seed.ts`).
 */
export async function importCollectionAction(input: {
  json: string
}): Promise<ActionResult<ImportSummary>> {
  const user = await requireUser()

  const parsed = parseBackupJSON(input.json)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  const result = await performImport(supabase, user.id, parsed.data)
  if (result.ok) revalidatePath("/", "layout")
  return result
}
