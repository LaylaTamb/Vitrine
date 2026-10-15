/**
 * O resumo de uma Sugestão — montado por regra, sem IA, com o que se sabe do
 * lugar (o tipo, vindo do OpenStreetMap) e o que eu anotei.
 *
 * Fica isolado de propósito: no dia em que o resumo for escrito por IA, só
 * esta função muda; o cartão continua recebendo uma frase pronta.
 */

import { formatDistance, formatRating } from "./format"

export interface SummaryInput {
  /** O que é o lugar ("Restaurante · japonesa"), se veio do OpenStreetMap. */
  typeLabel: string | null
  /** Em linha reta, em metros. */
  distance: number
  /** Minha nota, se a categoria usa estrelas e o item tem. */
  myRating: number | null
  tags: string[]
  /** `view.summary`: os dois primeiros textos que preenchi. */
  notes: string
}

/** "Restaurante · japonesa" → "Restaurante (japonesa)", com maiúscula no começo. */
function placeKind(typeLabel: string): string {
  const [kind, ...rest] = typeLabel.split(" · ")
  const text = rest.length > 0 ? `${kind} (${rest.join(", ")})` : kind
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Restaurante (japonesa) a 850 m. Sua nota: 4,5. Tags: rodízio, japonês." */
export function ruleSummary({ typeLabel, distance, myRating, tags, notes }: SummaryInput): string {
  const parts = [
    typeLabel
      ? `${placeKind(typeLabel)} a ${formatDistance(distance)}.`
      : `A ${formatDistance(distance)} daqui.`,
  ]
  if (myRating !== null) parts.push(`Sua nota: ${formatRating(myRating)}.`)
  if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}.`)
  if (notes.trim()) parts.push(`Você anotou: ${notes.trim()}.`)
  return parts.join(" ")
}
