/**
 * Explorar e cópias ligadas (migração 26): pegar uma categoria pública de
 * outra pessoa COM os itens (até 500), numa cópia que continua ligada à
 * original — itens novos do autor chegam, edições dele atualizam o que você
 * não editou, item apagado por ele fica marcado no seu. Quem copia e
 * sincroniza é o banco; aqui ficam a leitura das respostas e as frases.
 */

import { parseEstrutura } from "./fields"
import { itemCount, plural } from "./format"
import type { Estrutura } from "./types"

/** Quantos itens uma cópia traz de uma vez (e cada sincronização acrescenta). */
export const COPY_LIMIT = 500

/** O erro de usar o Explorar antes de a migração 26 rodar. */
export const EXPLORE_NOT_READY =
  "O Explorar ainda não está no banco: rode supabase/26_linked_copies.sql no SQL Editor do Supabase (antes dele, o 25)."

export interface ExploreCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  estrutura: Estrutura
  ratingEnabled: boolean
  owner: { username: string; display_name: string | null; avatar_url: string | null }
  /** Itens da categoria. */
  total: number
  /** Quantas pessoas já pegaram (como modelo ou com itens). */
  uses: number
  /** Os 3 melhores itens (maior nota; empate pelo nome). */
  preview: { name: string; rating: number | null }[]
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function count(value: unknown): number {
  return typeof value === "number" && value > 0 ? Math.trunc(value) : 0
}

/** O que `explore_public_categories` devolve, conferido campo a campo. */
export function parseExploreResults(raw: unknown): ExploreCategory[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): ExploreCategory[] => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const owner = row.owner as Record<string, unknown> | undefined
    const id = text(row.id)
    const name = text(row.name)
    const username = text(owner?.username)
    if (!id || !name || !username) return []
    const preview = (Array.isArray(row.preview) ? row.preview : []).flatMap((entry) => {
      const value = entry as { name?: unknown; rating?: unknown } | null
      const entryName = text(value?.name)
      if (!entryName) return []
      return [{ name: entryName, rating: typeof value?.rating === "number" ? value.rating : null }]
    })
    return [
      {
        id,
        name,
        icon: text(row.icon),
        color: text(row.color),
        estrutura: parseEstrutura(row.estrutura),
        ratingEnabled: row.rating_enabled !== false,
        owner: {
          username,
          display_name: text(owner?.display_name),
          avatar_url: text(owner?.avatar_url),
        },
        total: count(row.total),
        uses: count(row.uses),
        preview: preview.slice(0, 3),
      },
    ]
  })
}

/** O texto do botão: com mais de 500 itens, avisa que vêm os primeiros. */
export function takeLabel(total: number): string {
  return total > COPY_LIMIT ? `Pegar os primeiros ${COPY_LIMIT}` : "Pegar com itens"
}

/** O recado depois de pegar. */
export function copySummary(copied: number, total: number): string {
  if (total > copied) {
    return `Vieram os primeiros ${copied} de ${itemCount(total)}. Os outros chegam aos poucos, a cada vez que você abrir a categoria.`
  }
  return copied === 0 ? "Categoria copiada (ainda sem itens)." : `${itemCount(copied)} vieram junto.`
}

// ---------------------------------------------------------------------------
// A ligação
// ---------------------------------------------------------------------------

export type LinkStatus = "not_linked" | "unlinked" | "fresh" | "synced"

export interface LinkSync {
  status: LinkStatus
  author: string | null
  added: number
  updated: number
  removed: number
}

const LINK_STATUSES: LinkStatus[] = ["not_linked", "unlinked", "fresh", "synced"]

/** O que `sync_linked_category` devolve. Resposta estranha = nada mudou. */
export function parseLinkSync(raw: unknown): LinkSync {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const status = LINK_STATUSES.find((value) => value === row.status) ?? "not_linked"
  return {
    status,
    author: text(row.author),
    added: count(row.added),
    updated: count(row.updated),
    removed: count(row.removed),
  }
}

/** A sincronização mexeu em algo (e a página precisa ler de novo)? */
export function linkChanged(sync: LinkSync): boolean {
  return sync.status === "unlinked" || sync.added + sync.updated + sync.removed > 0
}

/** O que chegou agora, numa frase — ou `null` se nada mudou. */
export function linkNews(sync: LinkSync): string | null {
  if (sync.status !== "synced") return null
  const parts = []
  if (sync.added > 0) parts.push(plural(sync.added, "item novo", "itens novos"))
  if (sync.updated > 0) parts.push(plural(sync.updated, "item atualizado", "itens atualizados"))
  if (sync.removed > 0) {
    parts.push(plural(sync.removed, "item removido do original", "itens removidos do original"))
  }
  if (parts.length === 0) return null
  const from = sync.author ? ` de @${sync.author}` : ""
  return `Novidades${from}: ${parts.join(", ")}.`
}

export const UNLINKED_NOTICE =
  "A original ficou privada, foi apagada ou não está mais disponível: a ligação foi desfeita. A sua cópia continua como está."
