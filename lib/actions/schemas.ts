/**
 * Os schemas zod de toda escrita do app, num lugar só.
 *
 * Moram fora dos arquivos `"use server"` porque dois implementadores usam os
 * mesmos: as Server Actions de verdade (que gravam no Supabase) e o acervo em
 * memória da demonstração (`lib/demo/store.ts`). As regras e as mensagens de
 * erro ficam idênticas nos dois.
 */
import { z } from "zod"

import { SORT_KEYS, type SortKey } from "@/lib/domain/filter"
import { FIELD_TYPES } from "@/lib/domain/types"

export const uuid = z.uuid("Identificador inválido.")

// O app sempre gera `f_` + 6 alfanuméricos (`newFieldId()`), mas categoria
// importada (`lib/backup/import.ts`) pode trazer id legível tipo "visitas" —
// de propósito, pra dar pra escrever o JSON à mão. A validação aqui não pode
// ser mais estrita que `parseEstrutura`, que já aceita qualquer string não
// vazia, senão editar a estrutura de uma categoria importada nunca salva.
export const fieldId = z.string().trim().min(1, "Identificador de campo inválido.").max(80)

export const estruturaSchema = z.array(
  z.object({
    id: fieldId,
    nome: z.string().trim().min(1, "Dê um nome ao campo."),
    tipo: z.enum(FIELD_TYPES),
    opcoes: z.array(z.string()).optional(),
    moeda: z.string().optional(),
  })
)

// ---------------------------------------------------------------------------
// Pastas (Coleções e subpastas de categoria)
// ---------------------------------------------------------------------------

export const folderName = z
  .string()
  .trim()
  .min(1, "Dê um nome à pasta.")
  .max(80, "Nome muito longo.")

export const createFolderSchema = z.object({
  name: folderName,
  parentFolderId: uuid.nullable(),
  /** Ausente = o padrão do perfil (quem decide é o banco — migração 12). */
  isPublic: z.boolean().optional(),
})

/** Pública ou privada: uma pasta das Coleções ou uma categoria. */
export const visibilitySchema = z.object({ id: uuid, isPublic: z.boolean() })

export const defaultPrivacySchema = z.object({ isPublic: z.boolean() })

export const renameFolderSchema = z.object({ id: uuid, name: folderName })

export const moveFolderSchema = z.object({ id: uuid, targetFolderId: uuid.nullable() })

export const idSchema = z.object({ id: uuid })

export const createEntryFolderSchema = createFolderSchema
  .omit({ isPublic: true })
  .extend({ categoryId: uuid })

export const deleteEntryFolderSchema = z.object({
  id: uuid,
  /** `true`: subpastas e itens sobem um nível antes da pasta sumir. */
  keepContents: z.boolean(),
})

/** A ordem nova de um nível inteiro (subpastas ou itens), depois de um arraste. */
export const reorderInCategorySchema = z.object({
  categoryId: uuid,
  ids: z.array(uuid).min(1, "Nada para reordenar.").max(2000),
})

export const moveEntriesToFolderSchema = z.object({
  ids: z.array(uuid).min(1, "Selecione pelo menos um item."),
  categoryId: uuid,
  folderId: uuid.nullable(),
})

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export const sortKeySchema = z.enum(SORT_KEYS as [SortKey, ...SortKey[]])

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria.").max(80, "Nome muito longo."),
  icon: z.string().trim().max(4, "O ícone é um emoji só.").nullable(),
  color: z.string().nullable(),
  estrutura: estruturaSchema,
  /** `false` = lista simples, sem nota de estrelas. */
  ratingEnabled: z.boolean(),
  defaultSort: sortKeySchema,
})

export const createCategorySchema = categorySchema.extend({
  folderId: uuid.nullable(),
  /** Ausente = o padrão do perfil (quem decide é o banco — migração 12). */
  isPublic: z.boolean().optional(),
})

export const updateCategorySchema = categorySchema.extend({
  id: uuid,
  removedFieldIds: z.array(fieldId).optional(),
})

export const reorderSchema = z.object({
  items: z.array(z.object({ kind: z.enum(["folder", "category"]), id: uuid })),
})

export const structureImpactSchema = z.object({
  categoryId: uuid,
  fieldIds: z.array(fieldId),
  fieldOptions: z.array(z.object({ fieldId, options: z.array(z.string()) })).optional(),
})

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

export const entrySchema = z.object({
  categoryId: uuid,
  /** Subpasta da categoria. Ausente = não mexe; `null` = raiz. */
  folderId: uuid.nullable().optional(),
  name: z.string().trim().min(1, "Dê um nome ao item.").max(160, "Nome muito longo."),
  rating: z
    .number()
    .min(0, "A nota vai de 0 a 5.")
    .max(5, "A nota vai de 0 a 5.")
    .nullable(),
  imageUrl: z.string().trim().max(2048).nullable(),
  imageDisplay: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(3),
  }),
  customFields: z.record(z.string(), z.union([z.string(), z.number()])),
  tagIds: z.array(uuid),
})

export const updateEntrySchema = entrySchema.extend({ id: uuid })

export const deleteEntrySchema = z.object({ id: uuid, categoryId: uuid })

export const bulkSchema = z.object({
  ids: z.array(uuid).min(1, "Selecione pelo menos um item."),
  categoryId: uuid,
})

export const bulkTagSchema = bulkSchema.extend({
  tagId: uuid,
  mode: z.enum(["add", "remove"]),
})

export const bulkMoveSchema = bulkSchema.extend({ toCategoryId: uuid })

/** Meia estrela: a nota só existe em passos de 0,5. */
export function normalizeRating(rating: number | null): number | null {
  if (rating === null) return null
  const value = Math.min(5, Math.max(0, Math.round(rating * 2) / 2))
  return value === 0 ? null : value
}

// ---------------------------------------------------------------------------
// Mapa: localização dos itens (Geoapify)
// ---------------------------------------------------------------------------

export const geocodeEntrySchema = z.object({ entryId: uuid })

export const geocodePendingSchema = z.object({
  /** Ausente = o acervo inteiro de quem está logado. */
  categoryId: uuid.optional(),
  mode: z.enum(["pending", "retry"]).default("pending"),
  /** Início do lote (ISO): falha registrada depois disso não é tentada de novo. */
  startedAt: z.iso.datetime({ offset: true }).optional(),
})

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/** "Onde estou", digitado nas Sugestões — procurado, nunca gravado. */
export const geocodeAddressSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, "Digite um endereço com pelo menos 3 letras.")
    .max(300, "Endereço muito longo."),
})

export const placeDetailsSchema = z.object({
  placeIds: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{1,300}$/, "Lugar inválido."))
    .min(1, "Nenhum lugar para buscar.")
    .max(20, "No máximo 20 lugares por vez."),
})

export const routeTimesSchema = z.object({
  origin: latLngSchema,
  destinations: z
    .array(latLngSchema.extend({ key: z.string().min(1).max(200) }))
    .min(1, "Nenhum lugar para calcular o trajeto.")
    .max(10, "No máximo 10 trajetos por vez."),
  mode: z.enum(["walking", "driving"]),
})

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à tag.").max(40, "Nome muito longo."),
  color: z.string(),
})

export const updateTagSchema = tagSchema.extend({ id: uuid })

export const searchEntriesForTagSchema = z.object({ tagId: uuid, query: z.string().max(160) })

export const applyTagSchema = z.object({
  tagId: uuid,
  ids: z.array(uuid).min(1, "Selecione pelo menos um item."),
})
