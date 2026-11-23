/**
 * O ícone da categoria é **um emoji só** — nada de letra, número ou texto. Um
 * emoji pode ter vários códigos (tom de pele, bandeira, família com ZWJ,
 * "1️⃣"), então a conta é por grafema, como a tela mostra.
 */

/** O maior emoji que se grava (uma família com ZWJ e tons passa de 20 códigos UTF-16). */
export const EMOJI_ICON_MAX_LENGTH = 32

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const KEYCAP = /^[0-9#*]️?⃣$/u
// Letras e números que não sejam parte de um emoji (o "1" do "1️⃣" já saiu acima).
const TEXT = /[\p{L}\p{N}]/u

function graphemes(value: string): string[] {
  return [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(value)].map(
    (part) => part.segment
  )
}

/** `"☕"`, `"🇧🇷"`, `"👩🏽‍🍳"` sim; `"A"`, `"1"`, `"☕☕"`, `"a☕"` não. */
export function isEmojiIcon(raw: string): boolean {
  const value = raw.trim()
  if (!value || value.length > EMOJI_ICON_MAX_LENGTH) return false
  const parts = graphemes(value)
  if (parts.length !== 1) return false
  const [emoji] = parts
  if (KEYCAP.test(emoji)) return true
  return PICTOGRAPHIC.test(emoji) && !TEXT.test(emoji)
}

/** O ícone salvo, se for um emoji; o que não for (de antes da regra, de um backup) vira nada. */
export function emojiIconOrNull(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ""
  return isEmojiIcon(value) ? value : null
}
