import { drawableImageType, publicImageUrl, REMOTE_IMAGE_MAX_BYTES } from "@/lib/domain/remote-image"

const MAX_REDIRECTS = 3

/**
 * A foto de fora como `data:` para o gerador de imagem — ou `null` (link
 * estranho, fora do ar, lento, grande demais ou num formato que ele não
 * desenha): aí a imagem usa a inicial, em vez de falhar inteira.
 *
 * Os redirecionamentos são seguidos à mão, conferindo cada destino com a
 * mesma regra do link original (um deles poderia apontar para a rede interna).
 */
export async function remoteImageDataUri(raw: string | null | undefined): Promise<string | null> {
  let url = publicImageUrl(raw)
  const signal = AbortSignal.timeout(3000)
  try {
    for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(url, {
        signal,
        redirect: "manual",
        headers: { accept: "image/png,image/jpeg" },
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        url = location ? publicImageUrl(new URL(location, url).href) : null
        continue
      }
      const type = drawableImageType(response.headers.get("content-type"))
      const declared = Number(response.headers.get("content-length") ?? 0)
      if (!response.ok || !type || declared > REMOTE_IMAGE_MAX_BYTES) return null
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > REMOTE_IMAGE_MAX_BYTES) return null
      return `data:${type};base64,${Buffer.from(buffer).toString("base64")}`
    }
    return null
  } catch {
    return null
  }
}
