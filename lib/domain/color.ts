/**
 * Cor livre da categoria: o HEX que se digita ou cola, e a conversão para a
 * roda de cores (matiz × saturação, mais o brilho).
 */

/** Uma cor no modelo da roda: matiz 0–360, saturação e brilho 0–1. */
export interface Hsv {
  h: number
  s: number
  v: number
}

/** `#RGB` ou `#RRGGBB` (o `#` é opcional) → `#RRGGBB` maiúsculo; o resto → `null`. */
export function parseHexColor(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(text)) {
    return `#${text
      .split("")
      .map((digit) => digit + digit)
      .join("")}`.toUpperCase()
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`.toUpperCase()
  return null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** `#RRGGBB` → matiz, saturação e brilho. */
export function hexToHsv(hex: string): Hsv {
  const parsed = parseHexColor(hex) ?? "#000000"
  const r = parseInt(parsed.slice(1, 3), 16) / 255
  const g = parseInt(parsed.slice(3, 5), 16) / 255
  const b = parseInt(parsed.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)

  let h = 0
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta + 6) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

/** Matiz, saturação e brilho → `#RRGGBB` maiúsculo. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 1)
  const val = clamp(v, 0, 1)
  const chroma = val * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - chroma
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x]
  const hex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}
