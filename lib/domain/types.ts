/**
 * Tipos do domínio da Vitrine.
 *
 * Este módulo — e todo o resto de `lib/domain/` — é TypeScript puro: não
 * importa React nem Supabase. É o que os testes cobrem.
 */

import type { Visibility } from "./privacy"

/** Os tipos de campo que uma categoria pode ter. E só eles — nesta ordem no editor. */
export const FIELD_TYPES = [
  "star",
  "date",
  "str",
  "int",
  "decimal",
  "time",
  "currency",
  "select",
  "location",
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
  /**
   * Padrão de quem cria, no modelo antigo de 2 níveis (migração 12). Mantido
   * coerente pelo banco com `default_visibility`. Ler com `defaultVisibilityOf()`.
   */
  default_public?: boolean
  /** Padrão de quem cria (migração 14). Ausente = ler `default_public`. */
  default_visibility?: Visibility
  /**
   * Quando viu o aviso de que "Pública" agora quer dizer "na internet".
   * `null` = ainda não viu; ausente = a migração 14 não rodou.
   */
  public_notice_seen_at?: string | null
  /** A versão dos Termos e da Política aceita por último (migração 16). */
  terms_version?: string | null
  /** Quando aceitou (migração 16). */
  terms_accepted_at?: string | null
  /** Quando confirmou ter 18 anos ou mais (migração 16). */
  adult_confirmed_at?: string | null
  /** A bio do cartão, até 220 caracteres (migração 23). */
  bio?: string | null
  /** As categorias do cartão, na ordem dele — até 5 (migração 23). */
  card_category_ids?: string[]
  /** Os links das redes, já normalizados (migração 23). Ler com `socialLinksFrom()`. */
  social_links?: Record<string, unknown>
  /** O banner do cartão, por link (migração 36). */
  banner_url?: string | null
  /** Que parte do banner aparece: 0 = topo, 100 = pé (migração 36). */
  banner_position?: number
}

export interface Folder {
  id: string
  owner_id: string
  name: string
  parent_folder_id: string | null
  display_order: number
  created_at: string
  /**
   * Quem vê a pasta e o que está dentro dela (migração 14). Ausente = ler
   * `is_public`. Ler sempre com `visibilityOf()`.
   */
  visibility?: Visibility
  /** O modelo antigo de 2 níveis (migração 12), mantido coerente pelo banco. */
  is_public?: boolean
}

export interface Category {
  id: string
  owner_id: string
  name: string
  icon: string | null
  /** Cor de acento (`#RRGGBB`: uma das `TAG_COLORS` ou qualquer outra) — tinge o card dos itens. `null` = sem cor. */
  color: string | null
  folder_id: string | null
  display_order: number
  estrutura: Estrutura
  /**
   * `false` = lista simples: a categoria não usa a nota de 0 a 5 estrelas em
   * lugar nenhum (formulário, cards, filtro, Números).
   */
  rating_enabled: boolean
  /** A ordenação com que a categoria abre. Lida com `defaultSortOf()`. */
  default_sort: string
  created_at: string
  /**
   * Quem vê a categoria e os itens (migração 14). Ausente = ler `is_public`.
   * Ler sempre com `visibilityOf()`.
   */
  visibility?: Visibility
  /** O modelo antigo de 2 níveis (migração 12), mantido coerente pelo banco. */
  is_public?: boolean
  /**
   * 'inbox' = a "A organizar", caixa de entrada da conta (migração 17).
   * Ausente = comum. Ler com `isInbox()`.
   */
  kind?: CategoryKind
  /**
   * O campo principal do acesso rápido (migração 19): "name", "rating" ou o id
   * de um campo. Ausente = "name". Ler com `quickFieldOf()`.
   */
  quick_field?: string
  /** De qual categoria esta veio — modelo ou cópia (migração 25). */
  source_category_id?: string | null
  /** A cópia continua ligada à original (migração 26). */
  linked?: boolean
  /** A última sincronização da cópia ligada (migração 26). */
  linked_synced_at?: string | null
  /** A cópia de qual match esta categoria é (`kind = 'match'`, migração 31). */
  match_id?: string | null
}

/**
 * Uma categoria da pessoa em listas: as abas irmãs, os destinos de "Mover"
 * e o seletor "Categoria" do formulário do item (que precisa da estrutura e
 * das estrelas do destino para dizer o que fica para trás).
 */
export type CategorySummary = Pick<
  Category,
  "id" | "name" | "icon" | "display_order" | "estrutura" | "rating_enabled"
>

/**
 * O tipo da categoria: comum, a caixa de entrada "A organizar" ou a cópia de
 * um match (migração 31).
 */
export type CategoryKind = "normal" | "inbox" | "match"

/**
 * Subpasta DENTRO de uma categoria — organiza os itens dela
 * (ex.: Suco › Feitos em casa | Marca 1). Aninhável sem limite.
 */
export interface EntryFolder {
  id: string
  owner_id: string
  category_id: string
  name: string
  parent_folder_id: string | null
  display_order: number
  created_at: string
}

export interface Entry {
  id: string
  category_id: string
  owner_id: string
  /** Subpasta da categoria onde o item está. `null` = raiz da categoria. */
  folder_id: string | null
  name: string
  rating: number | null
  image_url: string | null
  image_display: ImageDisplay
  custom_fields: CustomFields
  /** Posição na "ordem manual", dentro do mesmo nível (categoria + subpasta). */
  display_order: number
  created_at: string
  updated_at: string
  /** De qual item da original este veio, numa cópia do Explorar (migração 26). */
  source_entry_id?: string | null
  /** Você mexeu nele depois da cópia: o autor não sobrescreve mais (migração 26). */
  edited_after_copy?: boolean
  /** O autor apagou o original; o seu fica, marcado (migração 26). */
  source_removed_at?: string | null
  /** Na cópia de um match (migração 31): de quem é o original. */
  match_owner_id?: string | null
  /** A cor dessa pessoa no match. */
  match_color?: string | null
  /** A chave de "mesma coisa" — ver `matchMarks`. */
  match_key?: string | null
  /** Os campos do original (estrutura + valores), só leitura — ver `matchOrigin`. */
  match_fields?: unknown
}

export interface Tag {
  id: string
  name: string
  color: string
}

export const PLACE_STATUSES = ["pending", "ok", "not_found", "error"] as const

export type PlaceStatus = (typeof PLACE_STATUSES)[number]

/**
 * Uma linha de `entry_places`: o resultado da busca (Geoapify) do endereço
 * de UM campo de Localização de um item. O texto continua em
 * `custom_fields`; isto é só o cache da busca — `address` é o texto exato
 * que foi procurado.
 */
export interface EntryPlace {
  entry_id: string
  field_id: string
  owner_id: string
  address: string
  formatted_address: string | null
  lat: number | null
  lng: number | null
  place_id: string | null
  status: PlaceStatus
  /** Quando o endereço foi procurado pela última vez. */
  geocoded_at: string | null
  /** O nome do lugar, segundo a Geoapify (migração 18). */
  place_name?: string | null
  /** O tipo do resultado ("amenity", "building", "street"…) (migração 18). */
  result_type?: string | null
  /** "node/123" etc., quando a Geoapify diz (migração 18). */
  osm_id?: string | null
  /** O lugar do catálogo comum — quem preenche é o banco (migração 18). */
  catalog_item_id?: string | null
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
  /** Subpasta da categoria. `null` = raiz. */
  folderId: string | null
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
  /** Posição na "ordem manual" do nível. */
  displayOrder: number
  createdAt: string
  /** nome + tags + todos os valores, em minúsculas: o alvo da busca livre. */
  search: string
  href: string
  /** Numa cópia ligada: o autor apagou o original (migração 26). */
  sourceRemoved: boolean
  /** Na cópia de um match: de quem é e as marcações (a página preenche). */
  match?: EntryMatch | null
}

/** Um item da cópia de um match, do ponto de vista de quem abre (migração 31). */
export interface EntryMatch {
  /** De quem é o original (vazio: conta que não existe mais). */
  ownerId: string
  /** "você" ou "@ana". */
  ownerLabel: string
  isMine: boolean
  color: string
  /** 2+ pessoas do match têm. */
  common: boolean
  /** Nota ≥ 4 de quem tem, e você não tem. */
  suggestionForMe: boolean
  /** Para quem mais é sugestão ("você" primeiro, depois "@ana"…). */
  suggestionFor: string[]
}
