/**
 * Tipos do domínio da Vitrine.
 *
 * Este módulo — e todo o resto de `lib/domain/` — é TypeScript puro: não
 * importa React nem Supabase. É o que os testes cobrem.
 */

/** Os tipos de campo que uma categoria pode ter. E só eles. */
export const FIELD_TYPES = [
  "star",
  "int",
  "decimal",
  "currency",
  "time",
  "str",
  "date",
  "select",
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/**
 * Um campo da `estrutura` de uma categoria.
 *
 * O `id` é estável e é ele que chaveia `entries.custom_fields` — por isso
 * renomear um campo não perde valor nenhum.
 */
export interface FieldDef {
  id: string
  nome: string
  tipo: FieldType
  /** Obrigatório (e não vazio) quando `tipo === "select"`. */
  opcoes?: string[]
  /** Só quando `tipo === "currency"`: um símbolo de `CURRENCY_SYMBOLS`. */
  moeda?: string
}

export type Estrutura = FieldDef[]

/** Valor gravado em `custom_fields`, sempre chaveado pelo id do campo. */
export type FieldValue = string | number
export type CustomFields = Record<string, FieldValue>

/** Enquadramento da imagem na tela. Puro CSS: a imagem nunca é tocada. */
export interface ImageDisplay {
  x?: number
  y?: number
  zoom?: number
}

export const DEFAULT_IMAGE_DISPLAY: Required<ImageDisplay> = { x: 50, y: 50, zoom: 1 }

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Folder {
  id: string
  owner_id: string
  name: string
  parent_folder_id: string | null
  display_order: number
  created_at: string
}

export interface Category {
  id: string
  owner_id: string
  name: string
  icon: string | null
  /** Cor de acento (uma das `TAG_COLORS`) — tinge o card dos itens. `null` = sem cor. */
  color: string | null
  folder_id: string | null
  display_order: number
  estrutura: Estrutura
  created_at: string
}

export interface Entry {
  id: string
  category_id: string
  owner_id: string
  name: string
  rating: number | null
  image_url: string | null
  image_display: ImageDisplay
  custom_fields: CustomFields
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

/** `entries` com os vínculos de tag já embutidos pelo PostgREST. */
export interface EntryWithTags extends Entry {
  entry_tags: { tag_id: string }[]
}

// ---------------------------------------------------------------------------
// O item achatado para a tela
// ---------------------------------------------------------------------------

/** Um campo preenchido do item, pronto para exibir. */
export interface EntryExtra {
  id: string
  label: string
  value: string
  tipo: FieldType
  isStar: boolean
  /** Só para `star`: largura do recorte da fileira de estrelas, em %. */
  percent: number
}

/**
 * O item já resolvido para a UI. Nenhum componente calcula nada: tudo que a
 * tela precisa mostrar já está aqui, formatado.
 */
export interface EntryView {
  id: string
  categoryId: string
  categoryName: string
  ownerId: string
  name: string
  /** Primeira letra do nome, maiúscula. Usada quando não há imagem. */
  initial: string
  imageUrl: string | null
  hasImage: boolean
  /** `transform`, ex.: "translate(0.00%, 0.00%) scale(1.000)" */
  imageTransform: string
  /** O enquadramento cru, para os sliders do formulário. */
  imageX: number
  imageY: number
  imageZoom: number
  rating: number | null
  hasRating: boolean
  /** "4,5" — ou "—" quando não há nota. */
  ratingLabel: string
  /** Largura do recorte da fileira de estrelas, ex.: "90%". */
  ratingPercent: string
  tags: Tag[]
  extras: EntryExtra[]
  /** Valores crus por id de campo — o que o motor do filtro compara. */
  values: CustomFields
  /** Os dois primeiros valores de `str`/`select` preenchidos, com " · ". */
  summary: string
  createdAt: string
  /** nome + tags + todos os valores, em minúsculas: o alvo da busca livre. */
  search: string
  href: string
}
