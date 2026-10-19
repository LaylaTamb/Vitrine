/**
 * Duração: na tela, horas e minutos (00:00); por dentro, sempre o total em
 * minutos — é o que `custom_fields`, o filtro e os Números já usam.
 */

export const MAX_DURATION_HOURS = 999
export const MAX_DURATION_MINUTES = MAX_DURATION_HOURS * 60 + 59

export interface HoursMinutes {
  hours: number
  minutes: number
}

/** Total em minutos → horas e minutos (`95 → 1h 35`). Inválido vira zero. */
export function splitMinutes(total: number): HoursMinutes {
  const safe = Number.isFinite(total)
    ? Math.min(MAX_DURATION_MINUTES, Math.max(0, Math.trunc(total)))
    : 0
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}

/**
 * Horas e minutos → total em minutos. Minuto acima de 59 vira hora
 * (`0h 90 → 90`), e o total para em 999:59.
 */
export function joinDuration(hours: number, minutes: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.trunc(hours)) : 0
  const m = Number.isFinite(minutes) ? Math.max(0, Math.trunc(minutes)) : 0
  return Math.min(MAX_DURATION_MINUTES, h * 60 + m)
}

/** `"95"` (minutos, como o formulário guarda) → `{ hours: "01", minutes: "35" }`; vazio fica vazio. */
export function clockParts(value: string): { hours: string; minutes: string } {
  if (value.trim() === "") return { hours: "", minutes: "" }
  const { hours, minutes } = splitMinutes(Number(value))
  return { hours: String(hours).padStart(2, "0"), minutes: String(minutes).padStart(2, "0") }
}
