import { describe, expect, it } from "vitest"

import { coverBox, drawableImageType, imageSizeOf, publicImageUrl } from "./remote-image"

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

describe("o banner do story: tamanho e recorte", () => {
  it("lê largura e altura de um PNG", () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    new DataView(png.buffer).setUint32(16, 1500)
    new DataView(png.buffer).setUint32(20, 500)
    expect(imageSizeOf(png)).toEqual({ width: 1500, height: 500 })
  })

  it("lê largura e altura de um JPEG (pulando os segmentos antes do SOF)", () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, // início
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 de 4 bytes
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x05, 0xdc, // SOF0: 500 × 1500
    ])
    expect(imageSizeOf(jpeg)).toEqual({ width: 1500, height: 500 })
  })

  it("outro formato, ou lixo: nada", () => {
    expect(imageSizeOf(new TextEncoder().encode("<svg></svg>"))).toBeNull()
    expect(imageSizeOf(Uint8Array.from([0xff, 0xd8, 0x00]))).toBeNull()
  })

  it("cobre a caixa e a posição escolhe o pedaço", () => {
    const image = { width: 1500, height: 1000 }
    const box = { width: 1080, height: 330 }
    // largura manda: 1080 × 720, sobram 390 na altura
    expect(coverBox(image, box, 0)).toEqual({ width: 1080, height: 720, left: 0, top: 0 })
    expect(coverBox(image, box, 50)).toMatchObject({ top: -195 })
    expect(coverBox(image, box, 100)).toMatchObject({ top: -390 })
    // altura manda (imagem bem larga): centrada na horizontal
    expect(coverBox({ width: 4000, height: 500 }, box, 50)).toEqual({
      width: 2640,
      height: 330,
      left: -780,
      top: 0,
    })
  })
})
