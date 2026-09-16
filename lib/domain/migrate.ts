/**
 * Migração de valores ao mover itens de uma categoria para outra.
 *
 * Regra: um valor é preservado quando a categoria de destino tem um campo com
 * o MESMO NOME e o MESMO TIPO (e, em `select`, o valor está entre as opções do
 * destino). O valor é regravado sob o id do campo do destino. Todo o resto é
 * perdido — por isso a UI mostra quantos valores serão descartados antes de
 * confirmar.
 */

import { normalizeName } from "./fields"
import type { CustomFields, Estrutura } from "./types"

export interface MigrationResult {
  values: CustomFields
  kept: number
  dropped: number
}

export function migrateCustomFields(
  from: Estrutura,
  to: Estrutura,
  custom: CustomFields
): MigrationResult {
  const destination = new Map(
    to.map((field) => [`${normalizeName(field.nome)}|${field.tipo}`, field])
  )

  const values: CustomFields = {}
  let kept = 0
  let dropped = 0

  for (const field of from) {
    const raw = custom[field.id]
    if (raw === undefined || raw === null || raw === "") continue

    const target = destination.get(`${normalizeName(field.nome)}|${field.tipo}`)
    if (!target) {
      dropped += 1
      continue
    }
    if (target.tipo === "select" && !(target.opcoes ?? []).includes(String(raw))) {
      dropped += 1
      continue
    }

    values[target.id] = raw
    kept += 1
  }

  return { values, kept, dropped }
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
