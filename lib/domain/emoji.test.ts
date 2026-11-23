import { describe, expect, it } from "vitest"

import { emojiIconOrNull, isEmojiIcon } from "./emoji"

describe("ícone da categoria", () => {
  it("aceita um emoji só, de qualquer tipo", () => {
    for (const emoji of ["☕", "🍽️", "✈️", "⭐", "❤️", "🇧🇷", "👩🏽‍🍳", "👨‍👩‍👧‍👦", "1️⃣", "🏳️‍🌈", " 🎬 "]) {
      expect([emoji, isEmojiIcon(emoji)]).toEqual([emoji, true])
    }
  })

  it("recusa letra, número, texto e mais de um emoji", () => {
    for (const text of ["", " ", "A", "ab", "1", "12", "#", "☕☕", "a☕", "☕ café", "→", "*"]) {
      expect([text, isEmojiIcon(text)]).toEqual([text, false])
    }
  })

  it("o ícone antigo que não é emoji vira nada", () => {
    expect(emojiIconOrNull("🍕")).toBe("🍕")
    expect(emojiIconOrNull(" 🍕 ")).toBe("🍕")
    expect(emojiIconOrNull("AB")).toBeNull()
    expect(emojiIconOrNull(null)).toBeNull()
    expect(emojiIconOrNull(undefined)).toBeNull()
  })
})
