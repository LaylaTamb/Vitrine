export { cn } from "cn"

/**
 * Variáveis CSS que tingem o card de um item com a cor da categoria dele.
 * `null`/`undefined` não retorna nada — o card cai nos tokens padrão
 * (`--border`, `--brand-glow`...) definidos em globals.css, sem mudança
 * visual nenhuma. `color-mix` mistura a cor da categoria com o token neutro
 * em vez de substituí-lo, para o acento ficar sutil.
 */
export function categoryTintVars(color: string | null | undefined): Record<string, string> | undefined {
  if (!color) return undefined
  return {
    "--tint-border": `color-mix(in srgb, ${color} 45%, var(--border))`,
    "--tint-border-hi": `color-mix(in srgb, ${color} 65%, var(--border-hi))`,
    "--tint-wash": `color-mix(in srgb, ${color} 8%, var(--surface))`,
    "--tint-glow": `color-mix(in srgb, ${color} 30%, transparent)`,
  }
}
