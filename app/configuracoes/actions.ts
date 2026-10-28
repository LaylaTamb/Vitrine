"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  bannerSchema,
  defaultVisibilitySchema,
  letterboxdHistorySchema,
  letterboxdUsernameSchema,
  profileCardSchema,
  socialLinksSchema,
} from "@/lib/actions/schemas"
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
import {
  BANNER_NOT_READY,
  CARD_NOT_READY,
  CARD_SIX_NOT_READY,
  clampBannerPosition,
  cleanCardIds,
  isCardLimitError,
  normalizeBannerUrl,
  normalizeSocialLink,
  SOCIAL_LABELS,
  SOCIAL_PROVIDERS,
  type SocialLinks,
} from "@/lib/domain/card"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import {
  LETTERBOXD_NOT_FOUND,
  LETTERBOXD_NOT_READY,
  letterboxdSummary,
} from "@/lib/domain/connected"
import { STEAM_NOT_READY, STEAM_RETURN_MESSAGES, syncSummary } from "@/lib/domain/steam"
import { parseCustomFields, parseEstrutura } from "@/lib/domain/fields"
import { normalizeSort } from "@/lib/domain/filter"
import { storedVisibility, VISIBILITY_NOT_READY, type Visibility } from "@/lib/domain/privacy"
import { normalizeQuickField, QUICK_FIELD_NAME } from "@/lib/domain/quick-field"
import { normalizeUsername, usernameProblem } from "@/lib/domain/username"
import { imageDisplayOf } from "@/lib/domain/view"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"
import { normalizeLetterboxdUsername } from "@/lib/import/letterboxd-rss"
import { fetchLetterboxdFeed, fetchLetterboxdFilmsPage } from "@/lib/letterboxd/client"
import { syncLetterboxdAccount, syncLetterboxdDetails } from "@/lib/letterboxd/sync"
import type { LetterboxdFeedFilm } from "@/lib/import/letterboxd-rss"
import { serverSecret, steamConfigured } from "@/lib/steam/client"
import { syncSteamAccount } from "@/lib/steam/sync"

// As mesmas regras da tela (`usernameProblem`); o banco confere de novo.
const usernameSchema = z.object({
  username: z.string().superRefine((value, context) => {
    const problem = usernameProblem(value)
    if (problem) context.addIssue({ code: "custom", message: problem })
  }),
})

const identitySchema = z.object({
  displayName: z.string().trim().max(80, "Nome muito longo."),
  avatarUrl: z.string().trim().max(2048).nullable(),
})

const USERNAME_NOT_READY =
  "A troca de @ ainda não está no banco: rode supabase/15_username_handles.sql no SQL Editor do Supabase."

/**
 * Troca o @ (Configurações). Só muda pela função `change_username`
 * (migração 15), que confere o limite de 2 trocas a cada 14 dias e deixa o @
 * antigo redirecionando.
 */
export async function updateUsernameAction(input: { username: string }): Promise<ActionResult> {
  const parsed = usernameSchema.safeParse({ username: normalizeUsername(input.username) })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle()

  if (current && (current as { username: string }).username !== parsed.data.username) {
    const { error } = await supabase.rpc("change_username", { p_new: parsed.data.username })
    if (error) {
      return isMissingSchema(error) ? { ok: false, error: USERNAME_NOT_READY } : fail(error)
    }
  }

  revalidatePath("/", "layout")
  return ok()
}

/**
 * O banner do cartão (migração 36): o link (vazio tira) e a posição (0 =
 * topo, 100 = pé). O link é conferido aqui e no banco.
 */
export async function updateBannerAction(input: {
  url: string
  position: number
}): Promise<ActionResult> {
  const parsed = bannerSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  const url = normalizeBannerUrl(parsed.data.url)
  if (!url.ok) return { ok: false, error: url.error }

  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ banner_url: url.value, banner_position: clampBannerPosition(parsed.data.position) })
    .eq("id", user.id)

  if (error) return isMissingColumn(error) ? { ok: false, error: BANNER_NOT_READY } : fail(error)

  revalidatePath("/v", "layout")
  return ok()
}

/** A foto (por link) e o nome de exibição — editados no próprio cartão, no Meu perfil. */
export async function updateIdentityAction(input: {
  displayName: string
  avatarUrl: string | null
}): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", user.id)

  if (error) return fail(error)

  revalidatePath("/", "layout")
  return ok()
}

/**
 * O cartão de apresentação (migração 23): bio e até 5 categorias (na ordem).
 * Categoria que não é da pessoa sai da lista; a que não é pública fica (o
 * cartão a esconde na leitura e ela volta sozinha se ficar pública de novo).
 */
export async function updateProfileCardAction(input: {
  bio: string
  categoryIds: string[]
}): Promise<ActionResult> {
  const parsed = profileCardSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const wanted = cleanCardIds(parsed.data.categoryIds)
  let categoryIds: string[] = []
  if (wanted.length > 0) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("owner_id", user.id)
      .in("id", wanted)
    if (error) return fail(error)
    const mine = new Set(((data ?? []) as { id: string }[]).map((row) => row.id))
    categoryIds = wanted.filter((id) => mine.has(id))
  }

  // Mais de duas linhas em branco seguidas viram uma.
  const bio = parsed.data.bio.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")
  const { error } = await supabase
    .from("profiles")
    .update({ bio: bio || null, card_category_ids: categoryIds })
    .eq("id", user.id)

  if (error && isCardLimitError(error)) return { ok: false, error: CARD_SIX_NOT_READY }
  if (error) return isMissingColumn(error) ? { ok: false, error: CARD_NOT_READY } : fail(error)

  revalidatePath("/v", "layout")
  return ok()
}

/**
 * Os links das redes (migração 23) — só link, mostrados no cartão. Cada um é
 * normalizado aqui de novo: a tela só ajuda.
 */
export async function updateSocialLinksAction(input: {
  links: Partial<Record<(typeof SOCIAL_PROVIDERS)[number], string>>
}): Promise<ActionResult> {
  const parsed = socialLinksSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const links: SocialLinks = {}
  for (const provider of SOCIAL_PROVIDERS) {
    const result = normalizeSocialLink(provider, parsed.data.links[provider] ?? "")
    if (!result.ok) return { ok: false, error: `${SOCIAL_LABELS[provider]}: ${result.error}` }
    if (result.value) links[provider] = result.value
  }

  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ social_links: links })
    .eq("id", user.id)

  if (error) return isMissingColumn(error) ? { ok: false, error: CARD_NOT_READY } : fail(error)

  revalidatePath("/v", "layout")
  return ok()
}

/**
 * "Sincronizar agora" da Steam (migração 24): no máximo uma vez por minuto,
 * pela mesma rotina da rodada diária.
 */
export async function syncSteamNowAction(): Promise<ActionResult<{ summary: string }>> {
  const user = await requireUser()
  if (!steamConfigured()) return { ok: false, error: STEAM_RETURN_MESSAGES["sem-chave"].text }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("external_id, last_attempt_at")
    .eq("user_id", user.id)
    .eq("provider", "steam")
    .maybeSingle()
  if (error) return isMissingSchema(error) ? { ok: false, error: STEAM_NOT_READY } : fail(error)
  const account = data as { external_id: string; last_attempt_at: string | null } | null
  if (!account) return { ok: false, error: "A Steam não está conectada a esta conta." }
  if (account.last_attempt_at && Date.now() - Date.parse(account.last_attempt_at) < 60_000) {
    return { ok: false, error: "Acabou de sincronizar: espere um minuto para tentar de novo." }
  }

  const result = await syncSteamAccount(supabase, user.id, account.external_id, {
    refreshName: true,
  })
  revalidatePath("/", "layout")
  if (!result.ok) return { ok: false, error: result.error }
  return ok({ summary: syncSummary(result.created, result.updated) })
}

// ---------------------------------------------------------------------------
// Letterboxd pelo @ (migração 39): o feed público do perfil, sem senha
// ---------------------------------------------------------------------------

const LETTERBOXD_OFF =
  "A conexão com o Letterboxd ainda não foi ativada neste Vitrine (falta o CRON_SECRET no servidor)."

/**
 * Liga o @ e já traz os filmes. O @ é conferido lendo o feed: se não existe,
 * não liga nada. Quem grava é a função do banco, com o segredo do servidor.
 */
export async function connectLetterboxdAction(input: {
  username: string
}): Promise<ActionResult<{ summary: string; categoryId: string | null }>> {
  const parsed = letterboxdUsernameSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  const username = normalizeLetterboxdUsername(parsed.data.username)
  if (!username) {
    return {
      ok: false,
      error: "Esse @ não parece do Letterboxd: use o nome que aparece no endereço do seu perfil.",
    }
  }

  const user = await requireUser()
  const secret = serverSecret()
  if (!secret) return { ok: false, error: LETTERBOXD_OFF }

  let feed
  try {
    feed = await fetchLetterboxdFeed(username)
  } catch {
    return {
      ok: false,
      error: "O Letterboxd não respondeu agora. Tente de novo em alguns minutos.",
    }
  }
  if (feed.status === "not_found") return { ok: false, error: LETTERBOXD_NOT_FOUND }

  const supabase = await createClient()
  const { error } = await supabase.rpc("letterboxd_connect", {
    p_secret: secret,
    p_user: user.id,
    p_username: username,
    p_display_name: feed.feed.displayName,
  })
  if (error) {
    return isMissingSchema(error) ? { ok: false, error: LETTERBOXD_NOT_READY } : fail(error)
  }

  const result = await syncLetterboxdAccount(supabase, user.id, username, { feed: feed.feed })
  revalidatePath("/", "layout")
  if (!result.ok) return { ok: false, error: result.error }
  return ok({
    summary: `Conectado. ${letterboxdSummary(result.created, result.updated)}`,
    categoryId: result.categoryId,
  })
}

/** "Sincronizar agora" do Letterboxd: no máximo uma vez por minuto. */
export async function syncLetterboxdNowAction(): Promise<ActionResult<{ summary: string }>> {
  const user = await requireUser()
  if (!serverSecret()) return { ok: false, error: LETTERBOXD_OFF }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("external_id, last_attempt_at")
    .eq("user_id", user.id)
    .eq("provider", "letterboxd")
    .maybeSingle()
  if (error)
    return isMissingSchema(error) ? { ok: false, error: LETTERBOXD_NOT_READY } : fail(error)
  const account = data as { external_id: string; last_attempt_at: string | null } | null
  if (!account) return { ok: false, error: "O Letterboxd não está conectado a esta conta." }
  if (account.last_attempt_at && Date.now() - Date.parse(account.last_attempt_at) < 60_000) {
    return { ok: false, error: "Acabou de sincronizar: espere um minuto para tentar de novo." }
  }

  const result = await syncLetterboxdAccount(supabase, user.id, account.external_id)
  revalidatePath("/", "layout")
  if (!result.ok) return { ok: false, error: result.error }
  return ok({ summary: letterboxdSummary(result.created, result.updated) })
}

/** Quantas páginas (72 filmes cada) uma chamada lê: cabe folgado no tempo de uma ação. */
const HISTORY_PAGES_PER_CALL = 4

const LETTERBOXD_BLOCKED =
  "O Letterboxd recusou a leitura agora. Tente de novo mais tarde — ou traga o histórico pelo arquivo de exportação, em Importar."

/**
 * O histórico inteiro do Letterboxd: lê a lista de filmes vistos do perfil,
 * algumas páginas por vez, e grava pela mesma `letterboxd_apply` do feed (o
 * que já existe é reconhecido; nada se repete). A tela chama de novo com a
 * `nextPage` até acabar. Traz nome, ano e nota; o pôster e os detalhes vêm
 * do TMDB, pela `letterboxdDetailsStepAction`.
 */
export async function letterboxdHistoryPagesAction(input: {
  page: number
}): Promise<
  ActionResult<{ created: number; updated: number; lastPage: number; nextPage: number | null }>
> {
  const parsed = letterboxdHistorySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)
  const user = await requireUser()
  if (!serverSecret()) return { ok: false, error: LETTERBOXD_OFF }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("connected_accounts")
    .select("external_id")
    .eq("user_id", user.id)
    .eq("provider", "letterboxd")
    .maybeSingle()
  if (error)
    return isMissingSchema(error) ? { ok: false, error: LETTERBOXD_NOT_READY } : fail(error)
  const username = (data as { external_id: string } | null)?.external_id
  if (!username) return { ok: false, error: "O Letterboxd não está conectado a esta conta." }

  // Uma página de cada vez (sem pressa: é o site de outra pessoa).
  const films: LetterboxdFeedFilm[] = []
  const from = parsed.data.page
  let lastPage = from
  let done = false
  for (let page = from; page < from + HISTORY_PAGES_PER_CALL; page++) {
    let result
    try {
      result = await fetchLetterboxdFilmsPage(username, page)
    } catch {
      return {
        ok: false,
        error: "O Letterboxd não respondeu agora. Tente de novo em alguns minutos.",
      }
    }
    if (result.status === "blocked") return { ok: false, error: LETTERBOXD_BLOCKED }
    if (result.status === "not_found") return { ok: false, error: LETTERBOXD_NOT_FOUND }
    films.push(...result.page.films)
    lastPage = result.page.lastPage
    if (page >= lastPage) {
      done = true
      break
    }
  }

  let created = 0
  let updated = 0
  if (films.length > 0) {
    // Sem detalhes aqui: a tela pede o TMDB depois, em passos.
    const result = await syncLetterboxdAccount(supabase, user.id, username, {
      feed: { displayName: null, films },
      detailsBatch: 0,
    })
    if (!result.ok) return { ok: false, error: result.error }
    created = result.created
    updated = result.updated
  }

  const nextPage = done ? null : from + HISTORY_PAGES_PER_CALL
  if (nextPage === null) revalidatePath("/", "layout")
  return ok({ created, updated, lastPage, nextPage })
}

/**
 * Um passo dos detalhes do TMDB (diretor, gênero, duração, país, sinopse e o
 * pôster de quem está sem): os próximos 40 filmes sem detalhes. A tela repete
 * enquanto `more` vier verdadeiro. Sem a chave do TMDB, não faz nada.
 */
export async function letterboxdDetailsStepAction(): Promise<
  ActionResult<{ processed: number; more: boolean }>
> {
  const user = await requireUser()
  const supabase = await createClient()
  const step = await syncLetterboxdDetails(supabase, user.id, [], { batch: 40 })
  if (!step.more) revalidatePath("/", "layout")
  return ok(step)
}

/** Desconecta o Letterboxd. A categoria e os filmes ficam (param de atualizar). */
export async function disconnectLetterboxdAction(): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "letterboxd")
  if (error)
    return isMissingSchema(error) ? { ok: false, error: LETTERBOXD_NOT_READY } : fail(error)
  revalidatePath("/v", "layout")
  return ok()
}

/** Desconecta a Steam. A categoria e os jogos ficam (param de atualizar). */
export async function disconnectSteamAction(): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("connected_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "steam")
  if (error) return isMissingSchema(error) ? { ok: false, error: STEAM_NOT_READY } : fail(error)
  revalidatePath("/v", "layout")
  return ok()
}

/**
 * O padrão de privacidade de quem cria: novas pastas e categorias nascem
 * Públicas, de Amigos ou Privadas. Não mexe nas que já existem — cada uma tem
 * o seu.
 */
export async function setDefaultVisibilityAction(input: {
  visibility: Visibility
}): Promise<ActionResult> {
  const parsed = defaultVisibilitySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ default_visibility: parsed.data.visibility })
    .eq("id", user.id)

  if (error) {
    return isMissingColumn(error) ? { ok: false, error: VISIBILITY_NOT_READY } : fail(error)
  }

  revalidatePath("/", "layout")
  return ok()
}

/** O aviso único de que "Pública" agora quer dizer "na internet": visto, não aparece mais. */
export async function dismissPublicNoticeAction(): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ public_notice_seen_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) {
    return isMissingColumn(error) ? { ok: false, error: VISIBILITY_NOT_READY } : fail(error)
  }

  revalidatePath("/")
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
      // `*`: traz a visibilidade (migrações 12 e 14) e o `kind` (migração 17)
      // quando existem, sem quebrar antes delas.
      supabase.from("folders").select("*").eq("owner_id", user.id),
      supabase.from("categories").select("*").eq("owner_id", user.id),
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
    (foldersResult.data ?? []) as {
      id: string
      name: string
      parent_folder_id: string | null
      visibility?: string | null
      is_public?: boolean | null
    }[]
  ).map((row) => {
    const visibility = storedVisibility(row)
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_folder_id,
      ...(visibility ? { visibility } : {}),
    }
  })

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
      kind?: string
      quick_field?: string
      visibility?: string | null
      is_public?: boolean | null
    }[]
  ).map((row) => {
    const estrutura = parseEstrutura(row.estrutura)
    const ratingEnabled = row.rating_enabled !== false
    const quick = normalizeQuickField(row.quick_field, estrutura, ratingEnabled)
    // A "A organizar" é sempre a da conta de quem importa: o nível dela não viaja.
    const visibility = row.kind === "inbox" ? undefined : storedVisibility(row)
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      folderId: row.folder_id,
      ...(visibility ? { visibility } : {}),
      estrutura,
      ratingEnabled,
      defaultSort: normalizeSort(row.default_sort, ratingEnabled),
      ...(row.kind === "inbox" ? { inbox: true } : {}),
      ...(quick === QUICK_FIELD_NAME ? {} : { quickField: quick }),
    }
  })

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
 * A validação e a gravação em si vivem em `lib/backup/import.ts`.
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
