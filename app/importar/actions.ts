"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  finishImportSchema,
  importGoogleSchema,
  importLetterboxdSchema,
  normalizeRating,
  prepareImportSchema,
} from "@/lib/actions/schemas"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import { normalizeName, parseEstrutura } from "@/lib/domain/fields"
import type { FieldDef } from "@/lib/domain/types"
import {
  GOOGLE_ESTRUTURA,
  GOOGLE_FOLDER,
  googleLocationText,
  googleSourceId,
  STARRED_LIST,
} from "@/lib/import/google"
import {
  LETTERBOXD_ESTRUTURA,
  LETTERBOXD_FOLDER,
  letterboxdTitleKey,
} from "@/lib/import/letterboxd"
import { requireUser } from "@/lib/queries/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Importar do Google Maps (Takeout) e do Letterboxd. Os arquivos são lidos
 * no navegador; aqui chegam as linhas, em lotes. `entries.source` +
 * `source_id` (migração 24) fazem reimportar não duplicar. A visibilidade das
 * categorias novas é o padrão do perfil (o banco aplica).
 */

const IMPORT_NOT_READY =
  "Importar precisa da origem dos itens no banco: rode supabase/24_connected_accounts.sql no SQL Editor do Supabase (e os anteriores)."

type Supabase = Awaited<ReturnType<typeof createClient>>

function failImport(error: unknown): ActionResult<never> {
  return isMissingColumn(error) || isMissingSchema(error)
    ? { ok: false, error: IMPORT_NOT_READY }
    : fail(error)
}

/** O campo da categoria: pelo id fixo da importação, senão pelo nome e tipo. */
function fieldOf(estrutura: FieldDef[], wanted: FieldDef): FieldDef | undefined {
  return (
    estrutura.find((field) => field.id === wanted.id && field.tipo === wanted.tipo) ??
    estrutura.find(
      (field) => field.tipo === wanted.tipo && normalizeName(field.nome) === normalizeName(wanted.nome)
    )
  )
}

async function nextRootOrder(supabase: Supabase, categoryId: string): Promise<number> {
  const { data } = await supabase
    .from("entries")
    .select("display_order")
    .eq("category_id", categoryId)
    .is("folder_id", null)
    .order("display_order", { ascending: false })
    .limit(1)
  const last = (data ?? [])[0] as { display_order: number } | undefined
  return (last?.display_order ?? -1) + 1
}

async function loadCategory(supabase: Supabase, userId: string, categoryId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, estrutura, rating_enabled")
    .eq("id", categoryId)
    .eq("owner_id", userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { id: string; estrutura: unknown; rating_enabled: boolean }
  return { id: row.id, estrutura: parseEstrutura(row.estrutura), ratingEnabled: row.rating_enabled }
}

/**
 * A pasta ("Google Maps" ou "Letterboxd") e uma categoria por nome dentro
 * dela — as que já existem ali são reaproveitadas (reimportar cai no mesmo
 * lugar). Nome já usado fora da pasta: "Nome (Google)", "Nome (Letterboxd)".
 * Devolve o id de cada categoria, pelo nome pedido.
 */
export async function prepareImportAction(input: {
  source: "google" | "letterboxd"
  names: string[]
}): Promise<ActionResult<Record<string, string>>> {
  const parsed = prepareImportSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const google = parsed.data.source === "google"
  const folderName = google ? GOOGLE_FOLDER : LETTERBOXD_FOLDER

  const [foldersResult, categoriesResult] = await Promise.all([
    supabase
      .from("folders")
      .select("id, name, display_order")
      .eq("owner_id", user.id)
      .is("parent_folder_id", null),
    supabase.from("categories").select("id, name, folder_id, display_order").eq("owner_id", user.id),
  ])
  if (foldersResult.error) return fail(foldersResult.error)
  if (categoriesResult.error) return fail(categoriesResult.error)

  const folders = (foldersResult.data ?? []) as { id: string; name: string; display_order: number }[]
  const categories = (categoriesResult.data ?? []) as {
    id: string
    name: string
    folder_id: string | null
    display_order: number
  }[]

  let folder = folders.find((item) => normalizeName(item.name) === normalizeName(folderName))
  if (!folder) {
    const order = folders.reduce((max, item) => Math.max(max, item.display_order), -1) + 1
    const { data, error } = await supabase
      .from("folders")
      .insert({ owner_id: user.id, name: folderName, display_order: order })
      .select("id, name, display_order")
      .single()
    if (error) return fail(error)
    folder = data as { id: string; name: string; display_order: number }
  }

  const inFolder = (name: string) =>
    categories.find((category) => category.folder_id === folder!.id && category.name === name)
  const taken = (name: string) => categories.some((category) => category.name === name)
  const suffix = google ? " (Google)" : " (Letterboxd)"
  let order =
    categories
      .filter((category) => category.folder_id === folder!.id)
      .reduce((max, category) => Math.max(max, category.display_order), -1) + 1

  const ids: Record<string, string> = {}
  for (const name of [...new Set(parsed.data.names)]) {
    // Reimportar: a que já está na pasta (com o nome ou com o sufixo).
    let found = inFolder(name) ?? inFolder(`${name}${suffix}`)
    if (!found) {
      let finalName = taken(name) ? `${name}${suffix}` : name
      for (let attempt = 2; taken(finalName); attempt++) finalName = `${name}${suffix} ${attempt}`
      const { data, error } = await supabase
        .from("categories")
        .insert({
          owner_id: user.id,
          name: finalName.slice(0, 80),
          icon: google ? (name === STARRED_LIST ? "⭐" : "📍") : "🎬",
          folder_id: folder.id,
          display_order: order++,
          estrutura: google ? GOOGLE_ESTRUTURA : LETTERBOXD_ESTRUTURA,
          rating_enabled: true,
        })
        .select("id, name, folder_id, display_order")
        .single()
      if (error) return fail(error)
      found = data as (typeof categories)[number]
      categories.push(found)
    }
    ids[name] = found.id
  }

  revalidatePath("/")
  return ok(ids)
}

/**
 * Um lote de lugares de uma lista do Google. Os que já foram importados
 * (mesma lista + mesmo link) ficam como estão. Com coordenadas, o lugar já
 * entra no Mapa; sem elas, fica na fila de busca de endereços.
 */
export async function importGoogleRowsAction(input: {
  categoryId: string
  listName: string
  rows: {
    title: string
    note: string | null
    url: string
    address: string | null
    lat: number | null
    lng: number | null
  }[]
}): Promise<ActionResult<{ added: number; skipped: number; pending: number }>> {
  const parsed = importGoogleSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const category = await loadCategory(supabase, user.id, parsed.data.categoryId)
  if (!category) return { ok: false, error: "Categoria não encontrada." }

  const location = fieldOf(category.estrutura, GOOGLE_ESTRUTURA[0])
  const noteField = fieldOf(category.estrutura, GOOGLE_ESTRUTURA[1])
  const base = await nextRootOrder(supabase, category.id)

  const rows = parsed.data.rows.map((place, index) => ({
    category_id: category.id,
    owner_id: user.id,
    name: place.title,
    custom_fields: {
      ...(location ? { [location.id]: googleLocationText(place) } : {}),
      ...(noteField && place.note ? { [noteField.id]: place.note } : {}),
    },
    display_order: base + index,
    source: "google",
    source_id: googleSourceId(parsed.data.listName, place.url),
  }))

  // Já importado (mesma origem) não entra de novo — e não volta erro.
  const { data, error } = await supabase
    .from("entries")
    .upsert(rows, { onConflict: "owner_id,source,source_id", ignoreDuplicates: true })
    .select("id, source_id")
  if (error) return failImport(error)
  const inserted = (data ?? []) as { id: string; source_id: string }[]

  let pending = 0
  if (location) {
    const bySource = new Map(
      parsed.data.rows.map((place) => [googleSourceId(parsed.data.listName, place.url), place])
    )
    const now = new Date().toISOString()
    const places = inserted.flatMap((entry) => {
      const place = bySource.get(entry.source_id)
      if (!place) return []
      if (place.lat === null || place.lng === null) {
        pending += 1
        return []
      }
      return [
        {
          entry_id: entry.id,
          field_id: location.id,
          owner_id: user.id,
          address: googleLocationText(place),
          formatted_address: place.address,
          lat: place.lat,
          lng: place.lng,
          place_id: null,
          status: "ok",
          geocoded_at: now,
        },
      ]
    })
    if (places.length > 0) {
      const placed = await supabase
        .from("entry_places")
        .upsert(places, { onConflict: "entry_id,field_id" })
      // Sem a tabela do mapa: os itens ficam, e o Mapa procura depois.
      if (placed.error) pending += places.length
    }
  }

  revalidatePath("/")
  return ok({ added: inserted.length, skipped: rows.length - inserted.length, pending })
}

/**
 * Um lote de filmes do Letterboxd: os novos entram; os que já estavam
 * (mesma URI — ou mesmo nome + ano, a chave dos que vieram pelo @, migração
 * 39) só têm a NOTA atualizada, se ela mudou.
 */
export async function importLetterboxdRowsAction(input: {
  categoryId: string
  rows: {
    key: string
    name: string
    year: number | null
    rating: number | null
    watchedDate: string | null
    review: string | null
  }[]
}): Promise<ActionResult<{ added: number; updated: number; skipped: number }>> {
  const parsed = importLetterboxdSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const category = await loadCategory(supabase, user.id, parsed.data.categoryId)
  if (!category) return { ok: false, error: "Categoria não encontrada." }

  const yearField = fieldOf(category.estrutura, LETTERBOXD_ESTRUTURA[0])
  const dateField = fieldOf(category.estrutura, LETTERBOXD_ESTRUTURA[1])
  const reviewField = fieldOf(category.estrutura, LETTERBOXD_ESTRUTURA[2])
  const ratingOf = (rating: number | null) =>
    category.ratingEnabled ? normalizeRating(rating) : null

  // A chave do arquivo (a URI) e a do @ (nome + ano): o mesmo filme não entra duas vezes.
  const titleKeyOf = (film: { name: string; year: number | null }) =>
    letterboxdTitleKey(film.name, film.year)
  const keys = [
    ...new Set(parsed.data.rows.flatMap((film) => [film.key, titleKeyOf(film)])),
  ]
  const existingResult = await supabase
    .from("entries")
    .select("id, source_id, rating")
    .eq("owner_id", user.id)
    .eq("source", "letterboxd")
    .in("source_id", keys)
  if (existingResult.error) return failImport(existingResult.error)
  const bySource = new Map(
    ((existingResult.data ?? []) as { id: string; source_id: string; rating: number | null }[]).map(
      (row) => [row.source_id, row]
    )
  )
  const existing = new Map(
    parsed.data.rows.flatMap((film) => {
      const row = bySource.get(film.key) ?? bySource.get(titleKeyOf(film))
      return row ? [[film.key, row] as const] : []
    })
  )

  const fresh = parsed.data.rows.filter((film) => !existing.has(film.key))
  let added = 0
  if (fresh.length > 0) {
    const base = await nextRootOrder(supabase, category.id)
    const { data, error } = await supabase
      .from("entries")
      .upsert(
        fresh.map((film, index) => ({
          category_id: category.id,
          owner_id: user.id,
          name: film.name,
          rating: ratingOf(film.rating),
          custom_fields: {
            ...(yearField && film.year !== null ? { [yearField.id]: film.year } : {}),
            ...(dateField && film.watchedDate ? { [dateField.id]: film.watchedDate } : {}),
            ...(reviewField && film.review ? { [reviewField.id]: film.review } : {}),
          },
          display_order: base + index,
          source: "letterboxd",
          source_id: film.key,
        })),
        { onConflict: "owner_id,source,source_id", ignoreDuplicates: true }
      )
      .select("id")
    if (error) return failImport(error)
    added = (data ?? []).length
  }

  // Reimportar: só a nota que mudou.
  let updated = 0
  for (const film of parsed.data.rows) {
    const row = existing.get(film.key)
    const rating = ratingOf(film.rating)
    if (!row || rating === null || Number(row.rating) === rating) continue
    const { error } = await supabase.from("entries").update({ rating }).eq("id", row.id)
    if (!error) updated += 1
  }

  revalidatePath("/")
  return ok({
    added,
    updated,
    skipped: parsed.data.rows.length - added - updated,
  })
}

/** O aviso no sininho quando a importação termina (migração 29; antes dela, nada). */
export async function finishImportAction(input: {
  source: "google" | "letterboxd"
  added: number
  pending: number
}): Promise<ActionResult> {
  const parsed = finishImportSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("notify_import_done", {
    p_source: parsed.data.source,
    p_added: parsed.data.added,
    p_pending: parsed.data.pending,
  })
  if (error && !isMissingSchema(error)) return fail(error)
  revalidatePath("/", "layout")
  return ok()
}

