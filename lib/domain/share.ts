/**
 * O acesso rápido (compartilhar do celular → Vitrine): o que chega vira o
 * Nome de um item, a categoria nova ganha um ícone sozinha, e o app tenta
 * adivinhar onde a pessoa quer guardar.
 *
 * Por enquanto, só texto: um link que chega é tratado como texto (sem buscar
 * título nem foto da página).
 */

import { normalizeTitle } from "./catalog"

/** O tamanho máximo do nome de um item (o mesmo do formulário). */
const NAME_MAX = 160

const URL_PATTERN = /\bhttps?:\/\/\S+/gi

/**
 * O que chegou pelo "Compartilhar" virando o Nome: o texto; sem texto, o
 * título; sem os dois, o link. Quando o texto tem palavras além de um link
 * (comum no Android: "Padaria X https://maps…"), o link sai.
 */
export function sharedName(input: {
  title?: string | null
  text?: string | null
  url?: string | null
}): string {
  const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim()
  const text = clean(input.text)
  const withoutLinks = clean(text.replace(URL_PATTERN, " "))
  const name = withoutLinks || clean(input.title) || text || clean(input.url)
  return name.slice(0, NAME_MAX).trim()
}

/** Plural simples: "filmes" → "filme", "séries" → "serie" (já sem acento). */
function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word
}

function words(text: string): string[] {
  return normalizeTitle(text).split(" ").filter(Boolean).map(singular)
}

/** Palavra-chave → ícone. A primeira que bater ganha. */
const ICONS: [string[], string][] = [
  [["cafe", "cafeteria", "padaria"], "☕"],
  [["bar", "drink", "cerveja", "chopp", "boteco"], "🍺"],
  [["vinho"], "🍷"],
  [
    [
      "restaurante",
      "comida",
      "prato",
      "lanchonete",
      "hamburguer",
      "hamburgueria",
      "pizza",
      "pizzaria",
      "sushi",
    ],
    "🍽️",
  ],
  [["doce", "sobremesa", "sorvete", "chocolate", "confeitaria"], "🍰"],
  [["receita", "cozinha"], "🍳"],
  [["filme", "cinema"], "🎬"],
  [["serie", "tv", "novela", "anime"], "📺"],
  [["livro", "leitura", "hq", "quadrinho", "manga"], "📚"],
  [["jogo", "game", "videogame"], "🎮"],
  [["musica", "album", "disco", "banda", "playlist"], "🎵"],
  [["podcast"], "🎙️"],
  [["show", "festival", "concerto"], "🎤"],
  [["teatro", "peca", "musical"], "🎭"],
  [["museu", "arte", "exposicao", "galeria"], "🖼️"],
  [["viagem", "lugar", "visitar", "passeio", "destino", "praia", "hotel", "trilha"], "📍"],
  [["roupa", "moda", "loja", "compra", "presente"], "🛍️"],
]

/** O ícone de uma categoria nova pelo nome dela ("Filmes de terror" → 🎬). Sem palavra-chave: ⭐. */
export function iconForCategoryName(name: string): string {
  const tokens = new Set(words(name))
  for (const [keys, icon] of ICONS) {
    if (keys.some((key) => tokens.has(key))) return icon
  }
  return "⭐"
}

/**
 * As categorias na ordem do uso mais recente (a do último item salvo
 * primeiro). Categoria sem item nenhum fica de fora — quem chama põe o resto
 * depois.
 */
export function recentCategoryIds(
  entries: { category_id: string; created_at: string }[]
): string[] {
  const latest = new Map<string, string>()
  for (const entry of entries) {
    const current = latest.get(entry.category_id)
    if (!current || entry.created_at > current) latest.set(entry.category_id, entry.created_at)
  }
  return [...latest.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => id)
}

/**
 * Onde o texto compartilhado provavelmente vai, se der para adivinhar:
 *   1. um item com o MESMO nome já existe → a categoria dele;
 *   2. o texto cita o nome de uma categoria ("filme bom: Duna" → Filmes);
 *   3. o texto tem quase todas as palavras do nome de um item → a categoria
 *      dele (a que tiver mais itens assim).
 * `null` = sem palpite.
 */
export function suggestCategoryId(
  text: string,
  categories: { id: string; name: string }[],
  entries: { name: string; category_id: string }[]
): string | null {
  const known = new Set(categories.map((category) => category.id))
  const normalized = normalizeTitle(text)
  if (!normalized) return null

  const exact = entries.find(
    (entry) => known.has(entry.category_id) && normalizeTitle(entry.name) === normalized
  )
  if (exact) return exact.category_id

  const tokens = new Set(words(text))
  const named = categories.find((category) => {
    const nameWords = words(category.name)
    return nameWords.length > 0 && nameWords.every((word) => tokens.has(word))
  })
  if (named) return named.id

  const votes = new Map<string, number>()
  for (const entry of entries) {
    if (!known.has(entry.category_id)) continue
    const entryWords = words(entry.name).filter((word) => word.length > 2)
    if (entryWords.length < 2) continue
    const hits = entryWords.filter((word) => tokens.has(word)).length
    if (hits / entryWords.length >= 0.75) {
      votes.set(entry.category_id, (votes.get(entry.category_id) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestVotes = 0
  for (const [id, count] of votes) {
    if (count > bestVotes) {
      best = id
      bestVotes = count
    }
  }
  return best
}
