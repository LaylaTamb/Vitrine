import { parseHexColor } from "./color"

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

/** A cor é uma das 8 da paleta? */
export function isPaletteColor(value: string | null | undefined): boolean {
  const text = String(value ?? "").toUpperCase()
  return TAG_COLORS.some((color) => color.value.toUpperCase() === text)
}

/** O nome da cor no resumo do editor: "Ocre", "Cor própria" ou "Sem cor". */
export function colorLabel(value: string | null | undefined): string {
  if (!value) return "Sem cor"
  const text = value.toUpperCase()
  return TAG_COLORS.find((color) => color.value.toUpperCase() === text)?.label ?? "Cor própria"
}

/**
 * Cor de categoria: uma das 8 da paleta ou qualquer outra em HEX (a "+" do
 * editor), e nula é uma opção válida (sem cor — visual padrão). Um valor que
 * não é cor vira nulo, em vez de cair num roxo padrão como as tags fazem.
 */
export function normalizeCategoryColor(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  return parseHexColor(value)
}

/**
 * Cada categoria tem as suas tags (migração 49), mas o filtro geral cruza as
 * categorias: "Barato" de Restaurantes e "Barato" de Cafés viram uma só, pelo
 * nome (sem diferenciar maiúscula e espaços). Fica a primeira de cada nome;
 * `canonical` leva o id de cada uma ao id da que ficou.
 */
export function mergeTagsByName<T extends { id: string; name: string }>(
  tags: T[]
): { tags: T[]; canonical: Map<string, string> } {
  const kept = new Map<string, T>()
  const canonical = new Map<string, string>()
  for (const tag of tags) {
    const key = tag.name.trim().toLowerCase()
    const first = kept.get(key) ?? tag
    kept.set(key, first)
    canonical.set(tag.id, first.id)
  }
  return { tags: [...kept.values()], canonical }
}
