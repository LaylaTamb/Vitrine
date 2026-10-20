/**
 * O catálogo comum (migração 18): saber que dois itens são a mesma coisa.
 *
 * Com id externo (Geoapify, OSM, Wikidata…), quem decide é o banco. Sem ele,
 * a base é o título normalizado — "O Poderoso Chefão" e "poderoso chefao"
 * são o mesmo filme. É o que o "Em comum" do Match (Fase 5) vai usar.
 */

/** Artigos que não contam no começo de um título (pt, en, es, fr, it). */
const LEADING_ARTICLES = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "the",
  "an",
  "el",
  "la",
  "los",
  "las",
  "le",
  "les",
  "il",
  "lo",
  "gli",
])

/**
 * O título como chave de comparação: minúsculas, sem acento, sem pontuação,
 * espaços simples e sem um artigo no começo ("The Matrix" → "matrix"). Um
 * título que é só o artigo fica como está ("A" → "a").
 */
export function normalizeTitle(title: string): string {
  const words = title
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    // apóstrofo junta ("l'amour" → "lamour", "d'água" → "dagua")
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)

  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift()
  return words.join(" ")
}

/** Os dois títulos são a mesma coisa (depois de normalizados)? Vazio nunca é igual a nada. */
export function sameTitle(a: string, b: string): boolean {
  const left = normalizeTitle(a)
  return left.length > 0 && left === normalizeTitle(b)
}
