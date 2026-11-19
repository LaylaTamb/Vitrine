/**
 * `toView` — achata um item do banco no objeto que a tela consome, para
 * nenhum componente precisar calcular nada na hora de renderizar.
 */

import { formatDateBR, formatDecimal, formatMinutes, formatMoney, formatRating } from "./format"
import { DEFAULT_CURRENCY, parseCustomFields, parseEstrutura } from "./fields"
import {
  DEFAULT_IMAGE_DISPLAY,
  type CustomFields,
  type Entry,
  type EntryExtra,
  type EntryView,
  type EntryWithTags,
  type Estrutura,
  type FieldDef,
  type FieldValue,
  type ImageDisplay,
  type ImageStyle,
  type Tag,
} from "./types"

/** Valor de um campo, formatado conforme o tipo. */
export function formatFieldValue(field: FieldDef, value: FieldValue): string {
  switch (field.tipo) {
    case "star":
      return formatRating(Number(value))
    case "time":
      return formatMinutes(Number(value))
    case "date":
      return formatDateBR(String(value))
    case "int":
      return String(Math.trunc(Number(value)))
    case "decimal":
      return formatDecimal(Number(value), 2)
    case "currency":
      return `${field.moeda ?? DEFAULT_CURRENCY} ${formatMoney(Number(value))}`
    default:
      return String(value)
  }
}

function normalizeImageDisplay(raw: unknown): Required<ImageDisplay> {
  const source = (raw && typeof raw === "object" ? raw : {}) as ImageDisplay
  const clamp = (value: unknown, fallback: number, min: number, max: number) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, num))
  }
  return {
    x: clamp(source.x, DEFAULT_IMAGE_DISPLAY.x, 0, 100),
    y: clamp(source.y, DEFAULT_IMAGE_DISPLAY.y, 0, 100),
    zoom: clamp(source.zoom, DEFAULT_IMAGE_DISPLAY.zoom, 1, MAX_IMAGE_ZOOM),
  }
}

/** O enquadramento salvo, com os limites aplicados. */
export function imageDisplayOf(display: unknown): Required<ImageDisplay> {
  return normalizeImageDisplay(display)
}

/**
 * O enquadramento salvo vira `object-position` + `transform-origin` no mesmo
 * ponto + `scale`. Assim x/y = 0–100 percorre a imagem INTEIRA em qualquer
 * zoom: no 1×, o que o `cover` corta (a sobra de uma imagem larga num card em
 * pé); com zoom, também o que a ampliação esconde. Nunca aparece borda vazia.
 */
export function imageStyleOf(display: unknown): ImageStyle {
  const { x, y, zoom } = normalizeImageDisplay(display)
  const point = `${x.toFixed(2)}% ${y.toFixed(2)}%`
  return { objectPosition: point, transformOrigin: point, transform: `scale(${zoom.toFixed(3)})` }
}

export const MAX_IMAGE_ZOOM = 3

/** Quanto a imagem "sobra" do quadro com `cover`, por eixo (1 = cabe exata). */
export function coverOverflow(imageRatio: number, frameRatio: number): { x: number; y: number } {
  if (!(imageRatio > 0) || !(frameRatio > 0)) return { x: 1, y: 1 }
  return { x: Math.max(1, imageRatio / frameRatio), y: Math.max(1, frameRatio / imageRatio) }
}

// Sem arredondar: a roda e a pinça mandam passos minúsculos, que o arredondamento
// engoliria. Quem arredonda é quem salva.
const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

/**
 * Arrastar: a imagem acompanha o dedo. `dx`/`dy` em fração do quadro.
 * Na tela, a janela visível começa em `x · (sobra − 1/zoom)` larguras do quadro.
 */
export function panFraming(
  display: unknown,
  dx: number,
  dy: number,
  overflow: { x: number; y: number }
): Required<ImageDisplay> {
  const { x, y, zoom } = normalizeImageDisplay(display)
  const move = (position: number, delta: number, over: number) => {
    const room = zoom * over - 1
    return room > 0 ? clampPercent(position - (delta / room) * 100) : position
  }
  return { x: move(x, dx, overflow.x), y: move(y, dy, overflow.y), zoom }
}

/** Zoom (roda ou pinça) mantendo parado o ponto `at` (fração do quadro). */
export function zoomFraming(
  display: unknown,
  nextZoom: number,
  at: { x: number; y: number },
  overflow: { x: number; y: number }
): Required<ImageDisplay> {
  const { x, y, zoom } = normalizeImageDisplay(display)
  const next = Math.min(MAX_IMAGE_ZOOM, Math.max(1, nextZoom))
  const axis = (position: number, u: number, over: number) => {
    const point = (position / 100) * (over - 1 / zoom) + u / zoom
    const room = over - 1 / next
    return room > 0 ? clampPercent(((point - u / next) / room) * 100) : 50
  }
  return { x: axis(x, at.x, overflow.x), y: axis(y, at.y, overflow.y), zoom: next }
}

/** Largura do recorte da fileira de estrelas: 3,5 estrelas → "70%". */
export function ratingPercentOf(rating: number | null | undefined): string {
  const value = Number(rating)
  if (!Number.isFinite(value) || value <= 0) return "0%"
  return `${Math.min(100, Math.max(0, value * 20))}%`
}

export interface EntryLike extends Entry {
  entry_tags?: { tag_id: string }[]
}

/**
 * Produz o `EntryView`.
 *
 * `estrutura` decide quais campos aparecem e em que ordem — valor de campo que
 * não existe mais simplesmente não é exibido.
 */
export function toView(
  entry: EntryLike,
  estrutura: Estrutura | unknown,
  tagsById: Map<string, Tag> | Record<string, Tag>,
  categoryName: string
): EntryView {
  const fields = Array.isArray(estrutura)
    ? (estrutura as Estrutura)
    : parseEstrutura(estrutura)
  const custom = parseCustomFields(entry.custom_fields)

  const lookupTag = (id: string): Tag | undefined =>
    tagsById instanceof Map ? tagsById.get(id) : tagsById[id]

  const links = (entry as EntryWithTags).entry_tags ?? []
  const tags: Tag[] = (Array.isArray(links) ? links : [])
    .map((link) => lookupTag(link.tag_id))
    .filter((tag): tag is Tag => Boolean(tag))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

  const extras: EntryExtra[] = []
  const summaryParts: string[] = []
  const values: CustomFields = {}

  for (const field of fields) {
    const raw = custom[field.id]
    if (raw === undefined || raw === null || raw === "") continue

    const value = formatFieldValue(field, raw)
    if (value === "") continue

    values[field.id] = raw

    extras.push({
      id: field.id,
      label: field.nome,
      value,
      tipo: field.tipo,
      isStar: field.tipo === "star",
      percent: field.tipo === "star" ? Math.min(100, Math.max(0, Number(raw) * 20)) : 0,
    })

    if ((field.tipo === "str" || field.tipo === "select") && summaryParts.length < 2) {
      summaryParts.push(value)
    }
  }

  const framing = normalizeImageDisplay(entry.image_display)
  const rating =
    entry.rating === null || entry.rating === undefined ? null : Number(entry.rating)
  const hasRating = rating !== null && Number.isFinite(rating) && rating > 0
  const name = entry.name ?? ""

  const search = [name, ...tags.map((tag) => tag.name), ...extras.map((extra) => extra.value)]
    .join(" ")
    .toLowerCase()

  return {
    id: entry.id,
    categoryId: entry.category_id,
    categoryName,
    folderId: entry.folder_id ?? null,
    ownerId: entry.owner_id,
    name,
    initial: (name.trim()[0] ?? "?").toUpperCase(),
    imageUrl: entry.image_url || null,
    hasImage: Boolean(entry.image_url),
    imageStyle: imageStyleOf(entry.image_display),
    imageX: framing.x,
    imageY: framing.y,
    imageZoom: framing.zoom,
    rating: hasRating ? rating : null,
    hasRating,
    ratingLabel: hasRating ? formatRating(rating) : "—",
    ratingPercent: ratingPercentOf(hasRating ? rating : 0),
    tags,
    extras,
    values,
    summary: summaryParts.join(" · "),
    displayOrder: Number(entry.display_order) || 0,
    createdAt: entry.created_at,
    search,
    href: `/categoria/${entry.category_id}/${entry.id}`,
    sourceRemoved: Boolean(entry.source_removed_at),
  }
}
