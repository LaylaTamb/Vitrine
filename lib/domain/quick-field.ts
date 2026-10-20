/**
 * O campo principal de uma categoria (migração 19): o que o acesso rápido
 * (compartilhar do celular, "você está em X?") pede além do Nome. Toda
 * categoria tem exatamente um — Nome, Estrelas ou um campo da estrutura.
 * Não precisa estar preenchido nos itens e não aparece em destaque nos cards.
 */

import { FIELD_TYPE_LABELS } from "./fields"
import type { Category, Estrutura } from "./types"

/** Nenhum além do Nome — o padrão de toda categoria. */
export const QUICK_FIELD_NAME = "name"
/** As Estrelas (só com elas ligadas). */
export const QUICK_FIELD_RATING = "rating"

export interface QuickFieldOption {
  value: string
  label: string
}

/**
 * O valor que vale de verdade: o escolhido, se ainda existir — campo
 * removido, ou Estrelas com as estrelas desligadas, voltam para o Nome.
 */
export function normalizeQuickField(
  value: string | null | undefined,
  estrutura: Estrutura,
  ratingEnabled: boolean
): string {
  if (!value || value === QUICK_FIELD_NAME) return QUICK_FIELD_NAME
  if (value === QUICK_FIELD_RATING) return ratingEnabled ? QUICK_FIELD_RATING : QUICK_FIELD_NAME
  return estrutura.some((field) => field.id === value) ? value : QUICK_FIELD_NAME
}

/** O campo principal de uma categoria. Ausente (antes da migração 19) = Nome. */
export function quickFieldOf(
  category: Pick<Category, "estrutura" | "rating_enabled" | "quick_field">
): string {
  return normalizeQuickField(category.quick_field, category.estrutura, category.rating_enabled)
}

/** As opções do seletor do editor, na ordem: Nome, Estrelas (se ligadas) e os campos. */
export function quickFieldOptions(estrutura: Estrutura, ratingEnabled: boolean): QuickFieldOption[] {
  return [
    { value: QUICK_FIELD_NAME, label: "Só o Nome" },
    ...(ratingEnabled ? [{ value: QUICK_FIELD_RATING, label: "Estrelas (a nota)" }] : []),
    ...estrutura
      // id igual a "name"/"rating" (categoria importada) não dá para distinguir: fica de fora.
      .filter((field) => field.id !== QUICK_FIELD_NAME && field.id !== QUICK_FIELD_RATING)
      .map((field) => ({
        value: field.id,
        label: `${field.nome} · ${FIELD_TYPE_LABELS[field.tipo]}`,
      })),
  ]
}
