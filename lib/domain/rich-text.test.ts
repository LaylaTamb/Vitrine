import { describe, expect, it } from "vitest"

import { parseRichText, plainRichText, safeHref } from "./rich-text"

const text = (value: string) => ({ type: "text", text: value })

describe("formato da bio", () => {
  it("negrito, itálico, sublinhado e riscado", () => {
    expect(parseRichText("**forte** *leve* __linha__ ~~fora~~")).toEqual([
      { type: "bold", children: [text("forte")] },
      text(" "),
      { type: "italic", children: [text("leve")] },
      text(" "),
      { type: "underline", children: [text("linha")] },
      text(" "),
      { type: "strike", children: [text("fora")] },
    ])
  })

  it("uma marca dentro da outra", () => {
    expect(parseRichText("*um **dois** três*")).toEqual([
      {
        type: "italic",
        children: [text("um "), { type: "bold", children: [text("dois")] }, text(" três")],
      },
    ])
  })

  it("texto comum não vira formatação", () => {
    expect(parseRichText("2 * 3 * 4")).toEqual([text("2 * 3 * 4")])
    expect(parseRichText("**sem fim")).toEqual([text("**sem fim")])
    expect(parseRichText("****")).toEqual([text("****")])
    expect(parseRichText("@ana_b e @bia_c")).toEqual([text("@ana_b e @bia_c")])
    expect(parseRichText("\\*literal\\*")).toEqual([text("*literal*")])
  })

  it("link só com http(s)", () => {
    expect(parseRichText("veja [meu blog](https://exemplo.com/a)!")).toEqual([
      text("veja "),
      { type: "link", href: "https://exemplo.com/a", children: [text("meu blog")] },
      text("!"),
    ])
    expect(parseRichText("[oi](javascript:alert(1))")).toEqual([text("[oi](javascript:alert(1))")])
    expect(safeHref("ftp://x")).toBeNull()
    expect(safeHref(" http://exemplo.com ")).toBe("http://exemplo.com/")
  })

  it("as quebras de linha ficam no texto", () => {
    expect(parseRichText("linha 1\n**linha 2**")).toEqual([
      text("linha 1\n"),
      { type: "bold", children: [text("linha 2")] },
    ])
  })

  it("só o texto, sem as marcas", () => {
    expect(plainRichText("**Cafés** e *filmes* — [blog](https://exemplo.com)")).toBe(
      "Cafés e filmes — blog"
    )
  })
})
