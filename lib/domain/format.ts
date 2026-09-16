/**
 * Formatação — toda casa decimal exibida usa vírgula, nunca ponto.
 */

/** `5 → "5"`, `4.5 → "4,5"` */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ""
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",")
}

/** `90 → "1h 30min"`, `120 → "2h"`, `45 → "45 min"`, `0 → ""` */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return ""
  const total = Math.trunc(minutes)
  if (total <= 0) return ""
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}min`
}

/** `"2024-05-03" → "03/05/2024"`. Devolve "" se não for uma data ISO. */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return ""
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  if (!match) return ""
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

/** `plural(1, "item", "itens") → "1 item"` */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Número com vírgula decimal. `4.25, 1 → "4,3"` */
export function formatDecimal(value: number, decimals = 1): string {
  if (Number.isNaN(value)) return ""
  const fixed = value.toFixed(decimals)
  // Só corta zeros à direita quando existe parte decimal — senão "100" viraria "1".
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
  return (trimmed === "" ? "0" : trimmed).replace(".", ",")
}

/** "12 itens" / "1 item" */
export function itemCount(count: number): string {
  return plural(count, "item", "itens")
}
