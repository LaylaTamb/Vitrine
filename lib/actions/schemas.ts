/**
 * Os schemas zod de toda escrita do app, num lugar só (fora dos arquivos
 * `"use server"`, que só podem exportar funções assíncronas).
 */
import { z } from "zod"

import { passwordProblem } from "@/lib/domain/auth"
import { BIO_MAX, CARD_MAX_CATEGORIES } from "@/lib/domain/card"
import { SORT_KEYS, type SortKey } from "@/lib/domain/filter"
import { VISIBILITIES } from "@/lib/domain/privacy"
import { QR_TOKEN_PATTERN } from "@/lib/domain/qr"
import { TEMPLATE_SORTS } from "@/lib/domain/templates"
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

/** Pública, Amigos ou Privada. */
export const visibilityLevel = z.enum(VISIBILITIES, "Visibilidade inválida.")

export const createFolderSchema = z.object({
  name: folderName,
  parentFolderId: uuid.nullable(),
  /** Ausente = o padrão do perfil (quem decide é o banco — migração 14). */
  visibility: visibilityLevel.optional(),
})

/** Quem vê uma pasta das Coleções ou uma categoria. */
export const visibilitySchema = z.object({ id: uuid, visibility: visibilityLevel })

export const defaultVisibilitySchema = z.object({ visibility: visibilityLevel })

export const renameFolderSchema = z.object({ id: uuid, name: folderName })

export const moveFolderSchema = z.object({ id: uuid, targetFolderId: uuid.nullable() })

export const idSchema = z.object({ id: uuid })

export const createEntryFolderSchema = createFolderSchema
  .omit({ visibility: true })
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
  /** O campo principal do acesso rápido (migração 19). Ausente = o Nome. */
  quickField: z.string().trim().max(80).optional(),
})

export const createCategorySchema = categorySchema.extend({
  folderId: uuid.nullable(),
  /** Ausente = o padrão do perfil (quem decide é o banco — migração 14). */
  visibility: visibilityLevel.optional(),
  /** O modelo de onde a estrutura veio (migração 25). */
  sourceCategoryId: uuid.optional(),
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
  rating: z.number().min(0, "A nota vai de 0 a 5.").max(5, "A nota vai de 0 a 5.").nullable(),
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
// Seguir e bloquear (migração 14)
// ---------------------------------------------------------------------------

/** O outro perfil de uma ação social (seguir, bloquear, remover seguidor). */
export const profileTargetSchema = z.object({ profileId: uuid })

/** O cartão de apresentação (migração 23): a bio e as categorias, na ordem. */
export const profileCardSchema = z.object({
  bio: z.string().trim().max(BIO_MAX, `A bio tem no máximo ${BIO_MAX} caracteres.`),
  categoryIds: z
    .array(uuid)
    .max(CARD_MAX_CATEGORIES, `No máximo ${CARD_MAX_CATEGORIES} categorias no cartão.`),
})

/**
 * Os links das redes (migração 23). Chegam como a pessoa digitou; a ação
 * normaliza cada um (`normalizeSocialLink`).
 */
const socialInput = z.string().max(300, "Link muito longo.").optional()
export const socialLinksSchema = z.object({
  links: z.object({
    instagram: socialInput,
    x: socialInput,
    discord: socialInput,
    spotify: socialInput,
    youtube: socialInput,
  }),
})

/** A busca de modelos (migração 25). */
export const templateSearchSchema = z.object({
  query: z.string().trim().max(80, "Busca muito longa."),
  sort: z.enum(TEMPLATE_SORTS),
})

/** O nome da categoria nova, para sugerir campos (migração 27). */
export const fieldSuggestionsSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria.").max(80, "Nome muito longo."),
})

// ---------------------------------------------------------------------------
// Importações: Google Maps (Takeout) e Letterboxd (Etapa 4.5)
// ---------------------------------------------------------------------------

export const importSourceSchema = z.enum(["google", "letterboxd"])

export const prepareImportSchema = z.object({
  source: importSourceSchema,
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
})

const googleRowSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().max(2000).nullable(),
  url: z.string().trim().min(1).max(2000),
  address: z.string().max(300).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
})

export const importGoogleSchema = z.object({
  categoryId: uuid,
  listName: z.string().trim().min(1).max(80),
  rows: z.array(googleRowSchema).min(1).max(200),
})

const letterboxdRowSchema = z.object({
  key: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1850).max(2200).nullable(),
  rating: z.number().min(0.5).max(5).nullable(),
  watchedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  review: z.string().max(5000).nullable(),
})

export const importLetterboxdSchema = z.object({
  categoryId: uuid,
  rows: z.array(letterboxdRowSchema).min(1).max(100),
})

export const finishImportSchema = z.object({
  source: importSourceSchema,
  added: z.number().int().min(0),
  pending: z.number().int().min(0),
})

/** Match (migração 30): chamar até 7 amigos; responder a um convite. */
export const createMatchSchema = z.object({
  userIds: z
    .array(uuid)
    .min(1, "Escolha pelo menos um amigo.")
    .max(7, "No máximo 8 pessoas por match (você e mais 7)."),
})

export const respondMatchSchema = z.object({ matchId: uuid, accept: z.boolean() })

/** Abrir (montar, na 1ª vez) a sua cópia de um match pronto (migração 31). */
export const openMatchSchema = z.object({ matchId: uuid })

/** O banner do cartão (migração 36): o link (vazio = sem banner) e a posição. */
export const bannerSchema = z.object({
  url: z.string().max(2100),
  position: z.number().finite(),
})

/** A busca de itens nas Coleções (migração 35). */
export const searchItemsSchema = z.object({ query: z.string().max(80) })

/** Tirar um match pronto ou cancelado da sua lista (migração 34). */
export const hideMatchSchema = z.object({ matchId: uuid })

/** "Trazer" um item da cópia de um match para a A organizar. */
export const bringFromMatchSchema = z.object({ entryId: uuid })

/** Pegar uma categoria com itens (migração 26). */
export const copyCategorySchema = z.object({ sourceId: uuid })

/** Desligar uma cópia da original (migração 26). */
export const unlinkCategorySchema = z.object({ categoryId: uuid })

/** O código de um QR pessoal lido (migração 22). */
export const qrTokenSchema = z.object({
  token: z.string().regex(QR_TOKEN_PATTERN, "Este QR não é do Vitrine."),
})

// ---------------------------------------------------------------------------
// Letterboxd pelo @ (migração 39)
// ---------------------------------------------------------------------------

/** O que a pessoa digitou (o @, o nome ou o link do perfil); quem normaliza é a action. */
/** O histórico inteiro do Letterboxd: de que página da lista de filmes continuar. */
export const letterboxdHistorySchema = z.object({ page: z.number().int().min(1).max(500) })

export const letterboxdUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Digite o seu @ do Letterboxd.")
    .max(200, "@ comprido demais."),
})

// ---------------------------------------------------------------------------
// Favoritos (migração 20)
// ---------------------------------------------------------------------------

/** A estrela de uma categoria: marcar ou desmarcar. */
export const categoryFavoriteSchema = z.object({ categoryId: uuid, favorite: z.boolean() })

/** As categorias favoritas, na ordem. Lista vazia = nenhuma. */
export const favoritesTabSchema = z.object({
  categoryIds: z
    .array(uuid)
    .max(500, "Categorias demais nos favoritos.")
    .refine((ids) => new Set(ids).size === ids.length, "Categoria repetida nos favoritos."),
})

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

/** "Você está em X?": um lugar por perto, pelo id da Geoapify (Etapa 4.4). */
const placeIdText = z.string().regex(/^[A-Za-z0-9_-]{1,300}$/, "Lugar inválido.")

export const placeRatingsSchema = z.object({
  placeId: placeIdText,
  osmId: z
    .string()
    .regex(/^(node|way|relation)\/\d{1,20}$/)
    .nullable(),
})

/**
 * Salvar um lugar por perto: o lugar é procurado de novo no servidor pelo id
 * (no cache), a partir da posição — nome e coordenadas nunca vêm do navegador.
 */
export const addNearbyPlaceSchema = latLngSchema.extend({
  placeId: placeIdText,
  categoryId: uuid,
  rating: z.number().min(0).max(5).nullable(),
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

// ---------------------------------------------------------------------------
// Conta: e-mail e senha (quem guarda e confere a senha é o Supabase Auth)
// ---------------------------------------------------------------------------

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Digite seu e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Esse e-mail não parece válido."))

/** Os requisitos da tela (`passwordProblem`) valem também no servidor. */
const newPassword = z.string().superRefine((value, context) => {
  const problem = passwordProblem(value)
  if (problem) context.addIssue({ code: "custom", message: problem })
})

export const signInSchema = z.object({
  email,
  // No login, só "preenchida": a regra de senha nova não vale para senha antiga.
  password: z.string().min(1, "Digite sua senha.").max(200, "Senha longa demais."),
})

/** A caixa "Tenho 18 anos ou mais e aceito…": sem ela marcada, nada feito. */
export const acceptTermsField = z.literal(
  true,
  "Para continuar, confirme que tem 18 anos ou mais e aceite os Termos e a Política de privacidade."
)

export const signUpSchema = z
  .object({ email, password: newPassword, confirm: z.string(), acceptTerms: acceptTermsField })
  .refine((data) => data.password === data.confirm, {
    message: "As duas senhas não são iguais.",
    path: ["confirm"],
  })

export const acceptTermsSchema = z.object({
  acceptTerms: acceptTermsField,
  next: z.string().max(2000).optional(),
})

export const deleteAccountSchema = z.object({
  confirm: z.string().trim().min(1, "Digite o seu @ para confirmar.").max(40),
})

export const passwordResetSchema = z.object({ email })

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((data) => data.password === data.confirm, {
    message: "As duas senhas não são iguais.",
    path: ["confirm"],
  })
