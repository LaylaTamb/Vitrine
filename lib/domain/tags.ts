/** A paleta de 8 cores das tags. */
export const TAG_COLORS = [
  { value: "#B98CC2", label: "Roxo" },
  { value: "#8FB3C9", label: "Azul" },
  { value: "#8FC9A6", label: "Verde" },
  { value: "#D6C08A", label: "Ocre" },
  { value: "#C97B7B", label: "Vermelho" },
  { value: "#C79BD0", label: "Lilás" },
  { value: "#9A9AA4", label: "Cinza" },
  { value: "#B08A6A", label: "Marrom" },
] as const

export const DEFAULT_TAG_COLOR = TAG_COLORS[0].value

/** Aceita só uma cor da paleta; qualquer outra coisa vira o roxo do tema. */
export function normalizeTagColor(value: unknown): string {
  const text = String(value ?? "").toUpperCase()
  return TAG_COLORS.some((color) => color.value.toUpperCase() === text)
    ? text
    : DEFAULT_TAG_COLOR
}
