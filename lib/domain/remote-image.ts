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
