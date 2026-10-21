/**
 * Tier list: a nota (estrelas) de cada item decide a fileira, como no Tier
 * Maker. Só leitura — mudar um item de fileira seria mudar a nota dele. O que
 * não tem nota vai para uma faixa "Sem nota" no fim (antes ficava de fora, e
 * uma categoria inteira sem notas — uma lista importada do Google — parecia
 * vazia).
 */

import type { EntryView } from "./types"

export type TierId = "S" | "A" | "B" | "C" | "D" | "E"

export interface Tier {
  id: TierId
  /** A menor nota que entra na fileira. */
  min: number
  /** Fundo da caixa da letra — as cores clássicas do Tier Maker. */
  color: string
  /** Quais notas entram, para leitor de tela e dica: "4,5 e 4". */
  notes: string
}

/** Texto escuro por cima das cores claras das fileiras. */
export const TIER_INK = "#131315"

/** As fileiras, de cima para baixo. */
export const TIERS: Tier[] = [
  { id: "S", min: 5, color: "#FF7F7F", notes: "5" },
  { id: "A", min: 4, color: "#FFBF7F", notes: "4,5 e 4" },
  { id: "B", min: 3, color: "#FFDF7F", notes: "3,5 e 3" },
  { id: "C", min: 2, color: "#FFFF7F", notes: "2,5 e 2" },
  { id: "D", min: 1, color: "#BFFF7F", notes: "1,5 e 1" },
  { id: "E", min: 0, color: "#7FFF7F", notes: "0,5 e 0" },
]

/**
 * A fileira de uma nota, por faixa: ≥ 5 S, ≥ 4 A, ≥ 3 B, ≥ 2 C, ≥ 1 D,
 * qualquer outra ≥ 0 E. Sem nota (ou nota que não é número) fica fora.
 *
 * Na prática a nota 0 nem chega aqui — `normalizeRating` grava 0 como
 * `null` —, mas a faixa cobre o 0 mesmo assim.
 */
export function tierOf(rating: number | null | undefined): TierId | null {
  if (rating === null || rating === undefined || !Number.isFinite(rating) || rating < 0) {
    return null
  }
  return TIERS.find((tier) => rating >= tier.min)?.id ?? null
}

export interface TierRow {
  tier: Tier
  views: EntryView[]
}

export interface TierGroups {
  /** Sempre as 6 fileiras, de S a E — vazias também, como no Tier Maker. */
  rows: TierRow[]
  /** Os itens sem nota, na ordem em que chegaram — a faixa "Sem nota". */
  unrated: EntryView[]
}

/** Distribui os itens nas fileiras mantendo a ordem em que chegaram (a do filtro). */
export function groupByTier(views: EntryView[]): TierGroups {
  const byTier = new Map<TierId, EntryView[]>(TIERS.map((tier) => [tier.id, []]))
  const unrated: EntryView[] = []

  for (const view of views) {
    const id = tierOf(view.rating)
    if (id === null) unrated.push(view)
    else byTier.get(id)!.push(view)
  }

  return {
    rows: TIERS.map((tier) => ({ tier, views: byTier.get(tier.id) ?? [] })),
    unrated,
  }
}
