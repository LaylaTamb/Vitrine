/**
 * Campos da `estrutura`: metadados dos tipos, geração de id estável,
 * validação, coerção dos valores do formulário e (de)serialização do JSON
 * usado pelo modo JSON do editor de categoria.
 */

import {
  FIELD_TYPES,
  type CustomFields,
  type Estrutura,
  type FieldDef,
  type FieldType,
  type FieldValue,
} from "./types"

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  star: "Estrelas (0-5)",
  int: "Número inteiro",
  time: "Duração (minutos)",
  str: "Texto",
  date: "Data",
  select: "Lista de opções",
}

/** Os tipos que aceitam filtro por faixa e média nas estatísticas. */
export const NUMERIC_FIELD_TYPES: FieldType[] = ["star", "int", "time"]

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value)
}

export function isNumericField(tipo: FieldType): boolean {
  return NUMERIC_FIELD_TYPES.includes(tipo)
}

/**
 * Nomes que toda categoria já tem de fábrica — não podem virar campo extra.
 */
export const RESERVED_FIELD_NAMES = ["nome", "imagem", "avaliação", "avaliacao"]

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/** `f_` + 6 caracteres alfanuméricos aleatórios. */
export function newFieldId(): string {
  let out = "f_"
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(6)
    cryptoObj.getRandomValues(bytes)
    for (const byte of bytes) out += ID_ALPHABET[byte % ID_ALPHABET.length]
    return out
  }
  for (let i = 0; i < 6; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return out
}

/** Normaliza para comparar nomes: sem acento, sem caixa, sem borda em branco. */
export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

// ---------------------------------------------------------------------------
// Leitura do que vem do banco
// ---------------------------------------------------------------------------

/**
 * Lê a `estrutura` vinda do jsonb com tolerância: descarta o que não é campo
 * válido e inventa um id para o campo que não tiver (não deveria acontecer no
 * schema v2, mas evita que um dado torto derrube a página).
 */
export function parseEstrutura(raw: unknown): Estrutura {
  if (!Array.isArray(raw)) return []
  const out: Estrutura = []
  const usedIds = new Set<string>()

  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Record<string, unknown>
    const nome = typeof candidate.nome === "string" ? candidate.nome.trim() : ""
    if (!nome) continue
    if (!isFieldType(candidate.tipo)) continue

    let id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    if (!id || usedIds.has(id)) id = newFieldId()
    usedIds.add(id)

    const field: FieldDef = { id, nome, tipo: candidate.tipo }

    if (candidate.tipo === "select") {
      const opcoes = Array.isArray(candidate.opcoes)
        ? candidate.opcoes.map((o) => String(o).trim()).filter(Boolean)
        : []
      if (opcoes.length === 0) continue
      field.opcoes = opcoes
    }

    out.push(field)
  }

  return out
}

/** Lê `custom_fields` do jsonb, mantendo só string e número. */
export function parseCustomFields(raw: unknown): CustomFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: CustomFields = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") out[key] = value
  }
  return out
}

// ---------------------------------------------------------------------------
// Coerção ao salvar
// ---------------------------------------------------------------------------

/**
 * Converte o valor do formulário (sempre string) de volta ao tipo do campo.
 * Devolve `null` quando o valor está vazio ou inválido — e valor nulo não é
 * gravado: a chave some do `custom_fields`.
 */
export function coerceFieldValue(field: FieldDef, raw: unknown): FieldValue | null {
  if (raw === null || raw === undefined) return null
  const text = typeof raw === "string" ? raw.trim() : String(raw).trim()
  if (text === "") return null

  switch (field.tipo) {
    case "star": {
      const num = Number(text.replace(",", "."))
      if (!Number.isFinite(num) || num <= 0) return null
      const clamped = Math.min(5, Math.max(0, Math.round(num * 2) / 2))
      return clamped === 0 ? null : clamped
    }
    case "int":
    case "time": {
      const num = Number(text.replace(",", "."))
      if (!Number.isFinite(num)) return null
      return Math.trunc(num)
    }
    case "date": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
      return match ? text : null
    }
    case "select":
      return field.opcoes?.includes(text) ? text : null
    case "str":
    default:
      return text
  }
}

/**
 * Monta o `custom_fields` a partir dos valores do formulário.
 * Campo que não existe mais na estrutura é descartado; valor vazio também.
 */
export function coerceCustomFields(
  estrutura: Estrutura,
  values: Record<string, unknown>
): CustomFields {
  const out: CustomFields = {}
  for (const field of estrutura) {
    const value = coerceFieldValue(field, values[field.id])
    if (value !== null) out[field.id] = value
  }
  return out
}

// ---------------------------------------------------------------------------
// Validação no modo Visual
// ---------------------------------------------------------------------------

/**
 * Valida um campo que está sendo acrescentado (ou renomeado, quando
 * `ignoreId` é passado). Devolve a mensagem de erro, ou `null` se estiver ok.
 */
export function validateField(
  estrutura: Estrutura,
  nome: string,
  tipo: FieldType,
  opcoes: string[] = [],
  ignoreId?: string
): string | null {
  const trimmed = nome.trim()
  if (!trimmed) return "Dê um nome ao campo."

  const normalized = normalizeName(trimmed)
  if (RESERVED_FIELD_NAMES.some((reserved) => normalizeName(reserved) === normalized)) {
    return `"${trimmed}" já existe em toda categoria.`
  }

  const duplicate = estrutura.some(
    (field) => field.id !== ignoreId && normalizeName(field.nome) === normalized
  )
  if (duplicate) return `Você já tem um campo chamado "${trimmed}" nesta categoria.`

  if (tipo === "select" && opcoes.filter((o) => o.trim()).length === 0) {
    return "Uma lista de opções precisa de pelo menos uma opção."
  }

  return null
}

/** "Salão, Delivery" → ["Salão", "Delivery"] */
export function parseOptions(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const value = part.trim()
    if (!value || seen.has(normalizeName(value))) continue
    seen.add(normalizeName(value))
    out.push(value)
  }
  return out
}

// ---------------------------------------------------------------------------
// Modo JSON do editor
// ---------------------------------------------------------------------------

export function serializeEstrutura(estrutura: Estrutura): string {
  return JSON.stringify(
    estrutura.map((field) =>
      field.tipo === "select"
        ? { id: field.id, nome: field.nome, tipo: field.tipo, opcoes: field.opcoes ?? [] }
        : { id: field.id, nome: field.nome, tipo: field.tipo }
    ),
    null,
    2
  )
}

export type EstruturaParseResult =
  | { ok: true; estrutura: Estrutura }
  | { ok: false; error: string }

/**
 * Lê o textarea do modo JSON com mensagens que apontam o campo problemático.
 * `previous` existe para preservar os ids já conhecidos: campo com id válido
 * mantém o id, campo sem id ganha um novo.
 */
export function parseEstruturaJSON(text: string, previous: Estrutura = []): EstruturaParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: "JSON inválido. Confira vírgulas, aspas e colchetes." }
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: "A estrutura precisa ser uma lista: [ { ... }, { ... } ]." }
  }

  const knownIds = new Set(previous.map((field) => field.id))
  const estrutura: Estrutura = []
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()

  for (let index = 0; index < data.length; index++) {
    const position = index + 1
    const item = data[index]

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Campo ${position}: cada campo precisa ser um objeto.` }
    }

    const candidate = item as Record<string, unknown>
    const nome = typeof candidate.nome === "string" ? candidate.nome.trim() : ""
    if (!nome) return { ok: false, error: `Campo ${position}: falta "nome".` }

    const reserved = RESERVED_FIELD_NAMES.some(
      (item2) => normalizeName(item2) === normalizeName(nome)
    )
    if (reserved) {
      return { ok: false, error: `Campo "${nome}": já existe em toda categoria.` }
    }

    if (candidate.tipo === undefined || candidate.tipo === null || candidate.tipo === "") {
      return { ok: false, error: `Campo "${nome}": falta "tipo".` }
    }
    if (!isFieldType(candidate.tipo)) {
      return {
        ok: false,
        error: `Campo "${nome}": tipo "${String(candidate.tipo)}" não existe. Use um destes: ${FIELD_TYPES.join(", ")}.`,
      }
    }

    const normalized = normalizeName(nome)
    if (usedNames.has(normalized)) {
      return { ok: false, error: `Campo "${nome}" aparece duas vezes.` }
    }
    usedNames.add(normalized)

    const field: FieldDef = { id: "", nome, tipo: candidate.tipo }

    if (candidate.tipo === "select") {
      const rawOptions = candidate.opcoes
      const opcoes = Array.isArray(rawOptions)
        ? rawOptions.map((option) => String(option).trim()).filter(Boolean)
        : []
      if (opcoes.length === 0) {
        return { ok: false, error: `Campo "${nome}": select precisa de "opcoes".` }
      }
      field.opcoes = opcoes
    }

    // Preserva o id quando ele já existia; senão gera um novo.
    const rawId = typeof candidate.id === "string" ? candidate.id.trim() : ""
    field.id = rawId && knownIds.has(rawId) && !usedIds.has(rawId) ? rawId : newFieldId()
    usedIds.add(field.id)

    estrutura.push(field)
  }

  return { ok: true, estrutura }
}

// ---------------------------------------------------------------------------
// Impacto de uma edição de estrutura
// ---------------------------------------------------------------------------

export interface EstruturaDiff {
  added: FieldDef[]
  removed: FieldDef[]
  renamed: { from: string; to: string }[]
}

/**
 * Compara duas estruturas pelo id do campo. Renomear não entra em `added` nem
 * em `removed` — com id estável, renomear é seguro e não avisa nada.
 */
export function diffEstrutura(before: Estrutura, after: Estrutura): EstruturaDiff {
  const beforeById = new Map(before.map((field) => [field.id, field]))
  const afterById = new Map(after.map((field) => [field.id, field]))

  const added = after.filter((field) => !beforeById.has(field.id))
  const removed = before.filter((field) => !afterById.has(field.id))
  const renamed: { from: string; to: string }[] = []

  for (const field of after) {
    const original = beforeById.get(field.id)
    if (original && original.nome !== field.nome) {
      renamed.push({ from: original.nome, to: field.nome })
    }
  }

  return { added, removed, renamed }
}
