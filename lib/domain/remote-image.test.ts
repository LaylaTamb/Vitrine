import { describe, expect, it } from "vitest"

import { drawableImageType, publicImageUrl } from "./remote-image"

describe("foto de fora buscada pelo servidor", () => {
  it("aceita endereço de internet comum", () => {
    expect(publicImageUrl("https://i.imgur.com/abc.png")?.href).toBe("https://i.imgur.com/abc.png")
    expect(publicImageUrl(" http://exemplo.com.br/foto.jpg ")?.hostname).toBe("exemplo.com.br")
  })

  it("recusa rede interna, IP solto e outros protocolos", () => {
    for (const raw of [
      "http://localhost:3000/a.png",
      "http://127.0.0.1/a.png",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/a.png",
      "http://intranet/a.png",
      "https://servidor.local/a.png",
      "https://app.internal/a.png",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
      "https://user:senha@exemplo.com/a.png",
      "não é link",
      "",
      null,
    ]) {
      expect(publicImageUrl(raw)).toBeNull()
    }
  })

  it("só desenha PNG e JPEG", () => {
    expect(drawableImageType("image/jpeg; charset=binary")).toBe("image/jpeg")
    expect(drawableImageType("IMAGE/PNG")).toBe("image/png")
    expect(drawableImageType("image/webp")).toBeNull()
    expect(drawableImageType("text/html")).toBeNull()
    expect(drawableImageType(null)).toBeNull()
  })
})
