/**
 * Sugestões de campos ao criar uma categoria (migração 27): primeiro o que
 * outras pessoas usam em categorias públicas parecidas (basta uma); sem
 * nada, a IA (Google Gemini, plano gratuito), que recebe SÓ o nome da
 * categoria. Aqui fica a leitura cuidadosa das duas respostas (a da IA
 * inclusive: ela pode inventar tipo, moeda ou lista vazia) e o pedido à IA.
 */

import {
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  isFieldType,
  newFieldId,
  normalizeName,
  RESERVED_FIELD_NAMES,
} from "./fields"
import type { Estrutura, FieldDef, FieldType } from "./types"

/** Quantas vezes por dia cada pessoa pode pedir à IA (o banco confere). */
export const AI_DAILY_LIMIT = 10

/** O erro de pedir sugestões antes de a migração 27 rodar. */
export const SUGGESTIONS_NOT_READY =
  "As sugestões ainda não estão no banco: rode supabase/27_field_suggestions.sql no SQL Editor do Supabase."

/** Nome mínimo para sugerir (normalizado): "Bar" sim, "Ba" não. */
export const SUGGEST_MIN_NAME = 3

const MAX_NAME = 40
const MAX_OPTIONS = 10
const MAX_AI_FIELDS = 6

export interface FieldSuggestion {
  nome: string
  tipo: FieldType
  opcoes?: string[]
  moeda?: string
  /** Quantas pessoas usam (só nas sugestões da comunidade). */
  owners?: number
}

/** O que a IA às vezes escreve no lugar dos símbolos que o app conhece. */
const CURRENCY_ALIASES: Record<string, string> = {
  "US$": "$",
  USD: "$",
  BRL: "R$",
  EUR: "€",
  JPY: "¥",
}

function currencyOf(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : ""
  if ((CURRENCY_SYMBOLS as readonly string[]).includes(text)) return text
  return CURRENCY_ALIASES[text.toUpperCase()] ?? CURRENCY_ALIASES[text] ?? DEFAULT_CURRENCY
}

function optionsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    const text = typeof item === "string" ? item.trim() : ""
    if (!text || text.length > MAX_NAME || seen.has(normalizeName(text))) continue
    seen.add(normalizeName(text))
    out.push(text)
    if (out.length >= MAX_OPTIONS) break
  }
  return out
}

/**
 * Lê uma lista de sugestões (da comunidade ou da IA), conferindo tudo: tipo
 * conhecido, nome curto e que não seja Nome/Imagem/Avaliação, sem repetir,
 * lista com pelo menos uma opção, moeda conhecida.
 */
export function parseFieldSuggestions(raw: unknown, max = 12): FieldSuggestion[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: FieldSuggestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const nome = typeof row.nome === "string" ? row.nome.trim().slice(0, MAX_NAME) : ""
    if (!nome || !isFieldType(row.tipo)) continue
    const key = normalizeName(nome)
    if (seen.has(key) || RESERVED_FIELD_NAMES.some((name) => normalizeName(name) === key)) continue

    const suggestion: FieldSuggestion = { nome, tipo: row.tipo }
    if (row.tipo === "select") {
      const opcoes = optionsOf(row.opcoes)
      if (opcoes.length === 0) continue
      suggestion.opcoes = opcoes
    }
    if (row.tipo === "currency") suggestion.moeda = currencyOf(row.moeda)
    if (typeof row.owners === "number" && row.owners > 0) suggestion.owners = Math.trunc(row.owners)

    seen.add(key)
    out.push(suggestion)
    if (out.length >= max) break
  }
  return out
}

/** Só o que ainda não está na categoria (pelo nome, sem acento nem caixa). */
export function newSuggestions(
  suggestions: FieldSuggestion[],
  estrutura: Estrutura
): FieldSuggestion[] {
  const taken = new Set(estrutura.map((field) => normalizeName(field.nome)))
  return suggestions.filter((suggestion) => !taken.has(normalizeName(suggestion.nome)))
}

/** "Trazer": o campo com as opções e a moeda — e um id novo, como todo campo novo. */
export function suggestionToField(suggestion: FieldSuggestion): FieldDef {
  return {
    id: newFieldId(),
    nome: suggestion.nome,
    tipo: suggestion.tipo,
    ...(suggestion.tipo === "select" ? { opcoes: suggestion.opcoes ?? [] } : {}),
    ...(suggestion.tipo === "currency" ? { moeda: suggestion.moeda ?? DEFAULT_CURRENCY } : {}),
  }
}

// ---------------------------------------------------------------------------
// O pedido à IA
// ---------------------------------------------------------------------------

const AI_TYPES: FieldType[] = [
  "str",
  "int",
  "decimal",
  "date",
  "time",
  "currency",
  "select",
  "location",
  "star",
]

/** O texto do pedido. Leva só o nome da categoria — nada da pessoa. */
export function geminiPrompt(categoryName: string): string {
  const name = categoryName.trim().slice(0, 80)
  return [
    "Você ajuda a montar categorias num app de listas pessoais de gostos (filmes, restaurantes, vinhos, trilhas…).",
    `Para uma categoria chamada "${name}", sugira de 3 a ${MAX_AI_FIELDS} campos úteis para registrar cada item.`,
    "Não sugira Nome, Imagem nem Avaliação geral: toda categoria já tem.",
    "Tipos: str (texto curto), int (número inteiro), decimal (número com vírgula), date (data), time (duração), currency (preço; diga a moeda em 'moeda': R$, $, € ou ¥), select (lista de opções; dê de 2 a 8 em 'opcoes'), location (endereço) e star (nota de 0 a 5 de um aspecto).",
    "Nomes curtos, em português do Brasil, com inicial maiúscula.",
  ].join("\n")
}

/** O formato da resposta que o Gemini tem que seguir (JSON). */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          tipo: { type: "STRING", enum: AI_TYPES },
          opcoes: { type: "ARRAY", items: { type: "STRING" } },
          moeda: { type: "STRING" },
        },
        required: ["nome", "tipo"],
      },
    },
  },
  required: ["fields"],
}

/** A resposta do `generateContent` → as sugestões (vazio se vier algo torto). */
export function parseGeminiResponse(json: unknown): FieldSuggestion[] {
  const candidates = (json as { candidates?: unknown } | null)?.candidates
  const parts = Array.isArray(candidates)
    ? (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts
    : undefined
  const text = Array.isArray(parts)
    ? parts.map((part) => (part as { text?: unknown })?.text ?? "").join("")
    : ""
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as { fields?: unknown }
    // "usado por N" não existe na resposta da IA.
    return parseFieldSuggestions(parsed?.fields, MAX_AI_FIELDS).map((suggestion) => ({
      ...suggestion,
      owners: undefined,
    }))
  } catch {
    return []
  }
}
