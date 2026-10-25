"use server"

import { revalidatePath } from "next/cache"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import {
  copyCategorySchema,
  fieldSuggestionsSchema,
  templateSearchSchema,
  unlinkCategorySchema,
} from "@/lib/actions/schemas"
import { askGeminiForFields, geminiApiKey } from "@/lib/ai/gemini"
import { isMissingColumn, isMissingSchema } from "@/lib/domain/errors"
import {
  AI_DAILY_LIMIT,
  parseFieldSuggestions,
  SUGGESTIONS_NOT_READY,
  type FieldSuggestion,
} from "@/lib/domain/field-suggestions"
import {
  EXPLORE_NOT_READY,
  parseExploreResults,
  type ExploreCategory,
} from "@/lib/domain/explore"
import {
  parseTemplates,
  TEMPLATES_NOT_READY,
  type CategoryTemplate,
  type TemplateSort,
} from "@/lib/domain/templates"
import { getCoversOf } from "@/lib/queries/explore"
import { requireUser } from "@/lib/queries/session"
import { serverSecret } from "@/lib/steam/client"
import { createClient } from "@/lib/supabase/server"

/**
 * Modelos, Explorar e sugestões de campos (migrações 25 a 27). Os
 * componentes importam direto daqui.
 */

/** Categorias públicas de outras pessoas, para começar uma nova a partir delas. */
export async function searchTemplatesAction(input: {
  query: string
  sort: TemplateSort
}): Promise<ActionResult<CategoryTemplate[]>> {
  const parsed = templateSearchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_public_categories", {
    p_query: parsed.data.query,
    p_sort: parsed.data.sort,
    p_limit: 30,
  })
  if (error) return isMissingSchema(error) ? { ok: false, error: TEMPLATES_NOT_READY } : fail(error)
  return ok(parseTemplates(data))
}

/** O Explorar: categorias públicas de outras pessoas, com itens (e as capas delas). */
export async function exploreAction(input: {
  query: string
  sort: TemplateSort
}): Promise<ActionResult<{ results: ExploreCategory[]; covers: Record<string, string[]> }>> {
  const parsed = templateSearchSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("explore_public_categories", {
    p_query: parsed.data.query,
    p_sort: parsed.data.sort,
    p_limit: 30,
  })
  if (error) return isMissingSchema(error) ? { ok: false, error: EXPLORE_NOT_READY } : fail(error)
  const results = parseExploreResults(data)
  return ok({ results, covers: await getCoversOf(results.map((category) => category.id)) })
}

/**
 * "Pegar com itens": cria a cópia ligada (até 500 itens, com nome, imagem,
 * campos, tags, nota e as localizações já encontradas).
 */
export async function copyCategoryAction(input: {
  sourceId: string
}): Promise<ActionResult<{ categoryId: string; copied: number; total: number }>> {
  const parsed = copyCategorySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("copy_category_with_items", {
    p_source: parsed.data.sourceId,
  })
  if (error) {
    if (isMissingSchema(error)) return { ok: false, error: EXPLORE_NOT_READY }
    if (String((error as { code?: unknown }).code) === "P0002") {
      return { ok: false, error: "Esta categoria não está mais disponível para pegar." }
    }
    return fail(error)
  }

  const result = data as { category_id?: unknown; copied?: unknown; total?: unknown } | null
  if (typeof result?.category_id !== "string") {
    return { ok: false, error: "Não deu para copiar agora. Tente de novo." }
  }
  revalidatePath("/")
  return ok({
    categoryId: result.category_id,
    copied: typeof result.copied === "number" ? result.copied : 0,
    total: typeof result.total === "number" ? result.total : 0,
  })
}

/**
 * Desliga a cópia da original: ela fica como está e para de receber as
 * novidades do autor. Não tem volta (para ligar de novo, pegue de novo).
 */
export async function unlinkCategoryAction(input: { categoryId: string }): Promise<ActionResult> {
  const parsed = unlinkCategorySchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("categories")
    .update({ linked: false })
    .eq("id", parsed.data.categoryId)
    .eq("owner_id", user.id)
  if (error) return isMissingColumn(error) ? { ok: false, error: EXPLORE_NOT_READY } : fail(error)

  revalidatePath(`/categoria/${parsed.data.categoryId}`)
  return ok()
}

// ---------------------------------------------------------------------------
// Sugestões de campos (migração 27)
// ---------------------------------------------------------------------------

/**
 * Os campos que outras pessoas usam em categorias públicas parecidas (basta
 * uma pessoa — migração 32). `aiAvailable`: dá para pedir à IA quando não
 * vier nada. Antes da migração 27, nada — e o painel nem aparece.
 */
export async function communityFieldsAction(input: {
  name: string
}): Promise<ActionResult<{ suggestions: FieldSuggestion[]; aiAvailable: boolean }>> {
  const parsed = fieldSuggestionsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("field_suggestions", { p_name: parsed.data.name })
  if (error) {
    if (isMissingSchema(error)) return ok({ suggestions: [], aiAvailable: false })
    return fail(error)
  }
  return ok({ suggestions: parseFieldSuggestions(data), aiAvailable: Boolean(geminiApiKey()) })
}

/**
 * A IA (Google Gemini, plano gratuito), quando ninguém tem uma categoria
 * parecida: manda SÓ o nome da categoria. A mesma resposta fica guardada para
 * o próximo que pedir o mesmo nome (sem gastar outra chamada); fora isso, no
 * máximo 10 pedidos por pessoa por dia (`AI_DAILY_LIMIT`, conferido no banco).
 */
export async function aiFieldsAction(input: {
  name: string
}): Promise<ActionResult<FieldSuggestion[]>> {
  const parsed = fieldSuggestionsSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error.issues)

  await requireUser()
  if (!geminiApiKey()) {
    return { ok: false, error: "A sugestão por IA não está ativada neste Vitrine." }
  }
  const supabase = await createClient()
  const name = parsed.data.name

  const cached = await supabase.rpc("cached_field_suggestions", { p_name: name })
  if (cached.error && isMissingSchema(cached.error)) {
    return { ok: false, error: SUGGESTIONS_NOT_READY }
  }
  const fromCache = parseFieldSuggestions(cached.data)
  if (fromCache.length > 0) return ok(fromCache)

  const quota = await supabase.rpc("take_ai_suggestion_quota")
  if (quota.error) return fail(quota.error)
  if (quota.data !== true) {
    return {
      ok: false,
      error: `Você já pediu ${AI_DAILY_LIMIT} sugestões à IA hoje. Amanhã tem mais — ou crie os campos à mão.`,
    }
  }

  let suggestions: FieldSuggestion[]
  try {
    suggestions = await askGeminiForFields(name)
  } catch {
    return { ok: false, error: "A IA não respondeu agora. Tente de novo daqui a pouco." }
  }

  // Guardar só funciona com o segredo do servidor (migração 24): sem ele, a
  // sugestão vale só para agora.
  const secret = serverSecret()
  if (secret && suggestions.length > 0) {
    await supabase.rpc("store_field_suggestions", {
      p_secret: secret,
      p_name: name,
      p_fields: suggestions,
    })
  }
  return ok(suggestions)
}
