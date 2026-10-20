/**
 * Migração de valores ao mover itens de uma categoria para outra.
 *
 * Um valor é preservado quando a categoria de destino tem:
 *   1. o MESMO CAMPO — mesmo id e mesmo tipo (duas categorias que vieram do
 *      mesmo modelo: os ids são preservados); ou, se não,
 *   2. um campo com o MESMO NOME e o MESMO TIPO.
 * Em `select`, o valor ainda precisa estar entre as opções do destino. Nome
 * igual com tipo diferente fica em branco. O valor é regravado sob o id do
 * campo do destino, e cada campo do destino recebe no máximo um valor. Todo
 * o resto é perdido — por isso a tela mostra o que fica para trás antes de
 * confirmar.
 */

import { normalizeName } from "./fields"
import type { CustomFields, Estrutura, FieldDef } from "./types"

export interface MigrationResult {
  values: CustomFields
  kept: number
  dropped: number
  /**
   * id do campo de origem → id do campo de destino, para cada valor mantido.
   * É o que leva junto o que depende do campo (a localização no mapa).
   */
  fieldMap: Record<string, string>
}

function hasValue(raw: unknown): boolean {
  return raw !== undefined && raw !== null && raw !== ""
}

const nameTypeKey = (field: FieldDef) => `${normalizeName(field.nome)}|${field.tipo}`

export function migrateCustomFields(
  from: Estrutura,
  to: Estrutura,
  custom: CustomFields
): MigrationResult {
  const byId = new Map(to.map((field) => [field.id, field]))
  const byNameType = new Map(to.map((field) => [nameTypeKey(field), field]))
  const filled = from.filter((field) => hasValue(custom[field.id]))

  // Duas passadas: quem casa pelo id tem a vez; só depois, pelo nome e tipo.
  const targets = new Map<string, FieldDef>()
  const used = new Set<string>()
  for (const field of filled) {
    const same = byId.get(field.id)
    if (same && same.tipo === field.tipo) {
      targets.set(field.id, same)
      used.add(same.id)
    }
  }
  for (const field of filled) {
    if (targets.has(field.id)) continue
    const match = byNameType.get(nameTypeKey(field))
    if (match && !used.has(match.id)) {
      targets.set(field.id, match)
      used.add(match.id)
    }
  }

  const values: CustomFields = {}
  const fieldMap: Record<string, string> = {}
  let kept = 0
  let dropped = 0

  for (const field of filled) {
    const raw = custom[field.id]
    const target = targets.get(field.id)
    if (!target || (target.tipo === "select" && !(target.opcoes ?? []).includes(String(raw)))) {
      dropped += 1
      continue
    }
    values[target.id] = raw
    fieldMap[field.id] = target.id
    kept += 1
  }

  return { values, kept, dropped, fieldMap }
}

/** Soma o impacto de mover vários itens de uma vez. */
export function migrationImpact(
  customList: CustomFields[],
  from: Estrutura,
  to: Estrutura
): { kept: number; dropped: number } {
  let kept = 0
  let dropped = 0
  for (const custom of customList) {
    const result = migrateCustomFields(from, to, custom)
    kept += result.kept
    dropped += result.dropped
  }
  return { kept, dropped }
}

export interface MoveSummary {
  /** Campos preenchidos (da origem) cujo valor vai junto. */
  kept: FieldDef[]
  /** Campos preenchidos cujo valor fica para trás. */
  dropped: FieldDef[]
  /** A nota some: o destino não usa estrelas. */
  ratingLost: boolean
}

/** O que acontece com UM item ao trocar de categoria — o diálogo do formulário de edição. */
export function moveSummary(
  from: Estrutura,
  to: Estrutura,
  custom: CustomFields,
  rating: number | null,
  toRatingEnabled: boolean
): MoveSummary {
  const { fieldMap } = migrateCustomFields(from, to, custom)
  const filled = from.filter((field) => hasValue(custom[field.id]))
  return {
    kept: filled.filter((field) => field.id in fieldMap),
    dropped: filled.filter((field) => !(field.id in fieldMap)),
    ratingLost: !toRatingEnabled && (rating ?? 0) > 0,
  }
}
