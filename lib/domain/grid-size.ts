/**
 * Tamanho da grade: quantos cards cabem por linha.
 *
 * O Tailwind v4 só gera as classes que aparecem escritas por inteiro no
 * código — `grid-cols-${n}` montado na hora não existe no CSS final. Por isso
 * cada tamanho é um mapa de strings completas.
 */

export type GridSize = "small" | "medium" | "large"

export const GRID_SIZES: GridSize[] = ["small", "medium", "large"]

/** O comportamento de antes do controle existir. */
export const DEFAULT_GRID_SIZE: GridSize = "medium"

export const GRID_SIZE_OPTIONS: { value: GridSize; label: string; letter: string }[] = [
  { value: "small", label: "Pequena", letter: "P" },
  { value: "medium", label: "Média", letter: "M" },
  { value: "large", label: "Grande", letter: "G" },
]

/** A grade de cards (itens, subpastas, pastas e categorias). */
export const GRID_CLASSES: Record<GridSize, string> = {
  small: "grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
  medium: "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  large: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
}

/** Largura da miniatura no tier list: ≈ 56, 80 e 112 px. */
export const TIER_THUMB_CLASSES: Record<GridSize, string> = {
  small: "w-14",
  medium: "w-20",
  large: "w-28",
}

/** Aceita qualquer coisa (o que veio do `localStorage`, por exemplo). Inválido → Média. */
export function normalizeGridSize(value: unknown): GridSize {
  return GRID_SIZES.find((size) => size === value) ?? DEFAULT_GRID_SIZE
}
