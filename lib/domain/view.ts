/**
 * `toView` — achata um item do banco no objeto que a tela consome, para
 * nenhum componente precisar calcular nada na hora de renderizar.
 */

import { formatDateBR, formatMinutes, formatRating } from "./format"
import { parseCustomFields, parseEstrutura } from "./fields"
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
    zoom: clamp(source.zoom, DEFAULT_IMAGE_DISPLAY.zoom, 1, 3),
  }
}

/** O enquadramento salvo, com os limites aplicados. */
export function imageDisplayOf(display: unknown): Required<ImageDisplay> {
  return normalizeImageDisplay(display)
}

/**
 * `transform` a partir do enquadramento salvo.
 *
 * `object-position` sozinho não dava: o curso de pan que ele permite depende
 * de quanto a imagem original "sobra" do card com `object-fit: cover`, então
 * uma imagem já próxima da proporção do card mal se move. Aqui a imagem fica
 * sempre centrada (`object-position` no padrão do navegador, 50% 50%) e todo
 * o enquadramento vem de escalar e depois transladar: a translação é a
 * transformação MAIS externa (a última da lista), então o deslocamento final
 * na tela é exatamente `translate()`, sem depender do zoom. Isso garante que
 * x/y = 0–100 sempre cobre 100% do respiro aberto pelo zoom, nos dois eixos.
 */
export function imageTransformOf(display: unknown): string {
  const { x, y, zoom } = normalizeImageDisplay(display)
  const slack = (zoom - 1) / 2
  const tx = -((x - 50) / 50) * slack * 100
  const ty = -((y - 50) / 50) * slack * 100
  return `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${zoom.toFixed(3)})`
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
    ownerId: entry.owner_id,
    name,
    initial: (name.trim()[0] ?? "?").toUpperCase(),
    imageUrl: entry.image_url || null,
    hasImage: Boolean(entry.image_url),
    imageTransform: imageTransformOf(entry.image_display),
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
    createdAt: entry.created_at,
    search,
    href: `/categoria/${entry.category_id}/${entry.id}`,
  }
}
