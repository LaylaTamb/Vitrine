/**
 * Modelos (migração 25): toda categoria pública (de outra pessoa, com pelo
 * menos um campo) serve de ponto de partida para uma nova. "Usar" traz só a
 * estrutura — nome, ícone, cor, estrelas, ordem padrão, campo principal e os
 * campos COM OS MESMOS IDS (é o que deixa trocar um item entre as duas sem
 * perder valor). Quem busca é o banco (`search_public_categories`).
 */

import { parseEstrutura } from "./fields"
import { normalizeSort, type SortKey } from "./filter"
import { normalizeQuickField } from "./quick-field"
import type { Estrutura } from "./types"

/** O erro de buscar modelos antes de a migração 25 rodar. */
export const TEMPLATES_NOT_READY =
  "Os modelos ainda não estão no banco: rode supabase/25_templates_and_explore.sql no SQL Editor do Supabase."

// ---------------------------------------------------------------------------
// Nome normalizado
// ---------------------------------------------------------------------------

const ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿ"
const PLAIN = "aaaaaaeeeeiiiiooooouuuucnyy"

/**
 * "Séries de TV" → "serie de tv": minúsculas, sem acento, só letras e
 * números e um singular simples por palavra (lições → licao, animais →
 * animal, bares → bar, álbuns → album, filmes → filme). Não é gramática:
 * é o bastante para "Filme" e "Filmes" caírem juntos.
 *
 * A MESMA regra roda no banco (`normalize_category_name`, migração 25):
 * mudou uma, mude a outra.
 */
export function normalizeCategoryName(name: string): string {
  let plain = ""
  for (const char of name.toLowerCase()) {
    const index = ACCENTED.indexOf(char)
    plain += index >= 0 ? PLAIN[index] : char
  }
  return plain
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(singular)
    .join(" ")
}

function singular(word: string): string {
  return word
    .replace(/([a-z]{2,})oes$/, "$1ao")
    .replace(/([a-z]{2,})ais$/, "$1al")
    .replace(/([a-z]{2,})(r|z)es$/, "$1$2")
    .replace(/([a-z]{2,})ns$/, "$1m")
    .replace(/([a-z]{3,})s$/, "$1")
}

// ---------------------------------------------------------------------------
// Os modelos que voltam da busca
// ---------------------------------------------------------------------------

export const TEMPLATE_SORTS = ["relevance", "popular", "recent"] as const

export type TemplateSort = (typeof TEMPLATE_SORTS)[number]

export interface CategoryTemplate {
  id: string
  name: string
  icon: string | null
  color: string | null
  estrutura: Estrutura
  ratingEnabled: boolean
  defaultSort: SortKey
  quickField: string
  owner: { username: string; display_name: string | null; avatar_url: string | null }
  /** Quantas pessoas já usaram (como modelo ou cópia). */
  uses: number
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** O que `search_public_categories` devolve, conferido campo a campo. */
export function parseTemplates(raw: unknown): CategoryTemplate[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): CategoryTemplate[] => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const owner = row.owner as Record<string, unknown> | undefined
    const id = text(row.id)
    const name = text(row.name)
    const username = text(owner?.username)
    if (!id || !name || !username) return []
    const estrutura = parseEstrutura(row.estrutura)
    if (estrutura.length === 0) return []
    const ratingEnabled = row.rating_enabled !== false
    return [
      {
        id,
        name,
        icon: text(row.icon),
        color: text(row.color),
        estrutura,
        ratingEnabled,
        defaultSort: normalizeSort(row.default_sort, ratingEnabled),
        quickField: normalizeQuickField(text(row.quick_field), estrutura, ratingEnabled),
        owner: {
          username,
          display_name: text(owner?.display_name),
          avatar_url: text(owner?.avatar_url),
        },
        uses: typeof row.uses === "number" && row.uses > 0 ? Math.trunc(row.uses) : 0,
      },
    ]
  })
}

/** "usado por 3 pessoas" — ou o convite de ser a primeira. */
export function usedByLabel(uses: number): string {
  if (uses <= 0) return "ninguém usou ainda"
  return uses === 1 ? "usado por 1 pessoa" : `usado por ${uses} pessoas`
}
