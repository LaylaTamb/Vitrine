/**
 * Imagens de fora que o SERVIDOR busca (a foto do perfil na imagem do story).
 * A foto é um link que a pessoa colou — então o servidor só busca endereço de
 * internet de verdade: nada de IP solto, `localhost` ou nome de rede interna,
 * para um link maldoso não fazer o servidor bater na rede onde ele roda.
 */

/** Os formatos que o gerador de imagem (`next/og`) desenha. */
export const REMOTE_IMAGE_TYPES = ["image/png", "image/jpeg"] as const

/** Até 2 MB: foto de perfil maior que isso não vale a espera. */
export const REMOTE_IMAGE_MAX_BYTES = 2 * 1024 * 1024

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".intranet"]

/** O endereço pode ser buscado pelo servidor? Devolve a URL pronta, ou `null`. */
export function publicImageUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host.includes(".")) return null // localhost, nomes de máquina
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null // IP solto
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  return url
}

/** O tipo da resposta é um que dá para desenhar? (`image/jpeg; charset=…` vale.) */
export function drawableImageType(contentType: string | null): string | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  return (REMOTE_IMAGE_TYPES as readonly string[]).includes(type) ? type : null
}

/**
 * Largura e altura de uma imagem PNG ou JPEG, lidas do cabeçalho — sem
 * decodificar nada. `null` = outro formato, ou cabeçalho estranho.
 *
 * Serve ao banner do story: o gerador de imagem não entende
 * `object-position`, então o recorte é calculado aqui (`coverBox`).
 */
export function imageSizeOf(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fits = (offset: number, length: number) => offset + length <= bytes.byteLength

  // PNG: assinatura de 8 bytes, e o IHDR traz largura e altura logo depois.
  if (fits(0, 24) && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    return width > 0 && height > 0 ? { width, height } : null
  }

  // JPEG: anda de segmento em segmento até um SOF (C0–CF, menos C4, C8 e CC).
  if (fits(0, 2) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (fits(offset, 4)) {
      if (bytes[offset] !== 0xff) return null
      const marker = bytes[offset + 1]
      const length = view.getUint16(offset + 2)
      const isFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isFrame && fits(offset, 9)) {
        const height = view.getUint16(offset + 5)
        const width = view.getUint16(offset + 7)
        return width > 0 && height > 0 ? { width, height } : null
      }
      if (length < 2) return null
      offset += 2 + length
    }
  }
  return null
}

/**
 * O "cover" com posição, na mão: o tamanho em que a imagem cobre a caixa
 * inteira e onde ela fica — no eixo da sobra, `position` (0 a 100) escolhe
 * o pedaço (0 = começo, 50 = meio, 100 = fim); no outro, centrada.
 */
export function coverBox(
  image: { width: number; height: number },
  box: { width: number; height: number },
  position: number
): { width: number; height: number; left: number; top: number } {
  const scale = Math.max(box.width / image.width, box.height / image.height)
  const width = Math.ceil(image.width * scale)
  const height = Math.ceil(image.height * scale)
  const fraction = Math.min(100, Math.max(0, position)) / 100
  return {
    width,
    height,
    // `|| 0`: sem o -0 de "nada sobrando".
    left: Math.round((box.width - width) / 2) || 0,
    top: Math.round((box.height - height) * fraction) || 0,
  }
}
