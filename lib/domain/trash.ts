/**
 * Lixeira (migração 37): pasta, categoria ou subpasta apagada fica 30 dias
 * guardada — dá para restaurar ou excluir de vez — e depois some sozinha.
 * Itens soltos não passam por aqui. As regras moram nas funções do banco;
 * aqui fica a leitura do que volta e as frases da tela.
 */

/** Quantos dias o apagado fica na lixeira. */
export const TRASH_DAYS = 30

/** O erro de usar a lixeira antes de a migração 37 rodar. */
export const TRASH_NOT_READY =
  "A lixeira ainda não está no banco: rode supabase/37_trash.sql no SQL Editor do Supabase."

export type TrashKind = "folder" | "category" | "entry_folder"

const KINDS: TrashKind[] = ["folder", "category", "entry_folder"]

export interface TrashItem {
  id: string
  kind: TrashKind
  name: string
  icon: string | null
  /** Onde morava: "Coleções › Comida", "em Restaurantes". */
  location: string | null
  itemCount: number
  deletedAt: string
  purgeAfter: string
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** As linhas de `trash_items` → a tela (o que vier torto fica de fora). */
export function parseTrashItems(raw: unknown): TrashItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value): TrashItem[] => {
    const row = value as Record<string, unknown> | null
    const id = text(row?.id)
    const kind = KINDS.find((option) => option === row?.kind)
    const deletedAt = text(row?.deleted_at)
    const purgeAfter = text(row?.purge_after)
    if (!id || !kind || !deletedAt || !purgeAfter) return []
    const count = Number(row?.item_count)
    return [
      {
        id,
        kind,
        name: text(row?.name) ?? "Sem nome",
        icon: text(row?.icon),
        location: text(row?.location),
        itemCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
        deletedAt,
        purgeAfter,
      },
    ]
  })
}

/** Quantos dias faltam para sumir de vez (arredonda para cima; 0 = hoje). */
export function daysLeft(purgeAfter: string, now: Date): number {
  const ms = new Date(purgeAfter).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

/** "some em 12 dias", "some amanhã", "some hoje". */
export function purgeLabel(purgeAfter: string, now: Date): string {
  const days = daysLeft(purgeAfter, now)
  if (days <= 0) return "some hoje"
  if (days === 1) return "some amanhã"
  return `some em ${days} dias`
}

export const TRASH_KIND_LABELS: Record<TrashKind, string> = {
  folder: "Pasta",
  category: "Categoria",
  entry_folder: "Subpasta",
}

/** A resposta de `restore_trash_item`. */
export interface RestoreResult {
  kind: TrashKind
  id: string | null
  name: string
  renamed: boolean
  /** Subpasta: a categoria onde ela voltou. */
  categoryId: string | null
}

export function parseRestoreResult(raw: unknown): RestoreResult {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    kind: KINDS.find((option) => option === row.kind) ?? "category",
    id: text(row.id),
    name: text(row.name) ?? "",
    renamed: row.renamed === true,
    categoryId: text(row.category_id),
  }
}

/** A frase do aviso depois de restaurar. */
export function restoredMessage(result: RestoreResult): string {
  if (result.kind === "entry_folder") return `“${result.name}” voltou para a categoria dela.`
  if (result.renamed) return `Voltou como “${result.name}” (já havia uma com o mesmo nome).`
  return `“${result.name}” voltou para as Coleções.`
}

/** Para onde o "Abrir" leva depois de restaurar. */
export function restoredHref(result: RestoreResult): string {
  if (result.kind === "category" && result.id) return `/categoria/${result.id}`
  if (result.kind === "folder" && result.id) return `/?pasta=${result.id}`
  if (result.kind === "entry_folder" && result.categoryId && result.id) {
    return `/categoria/${result.categoryId}?pasta=${result.id}`
  }
  return "/"
}
