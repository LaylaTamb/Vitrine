/**
 * Endereços de nível — puro, sem React: serve tanto ao Server Component que
 * monta um link quanto ao Client Component que troca de pasta.
 */

/** O parâmetro de URL da pasta aberta (Coleções ou subpasta de categoria). */
export const FOLDER_PARAM = "pasta"

/** Link para um nível: `/?pasta=<id>`, `/categoria/<id>?pasta=<id>`… */
export function withFolder(href: string, folderId: string | null): string {
  if (!folderId) return href
  return `${href}${href.includes("?") ? "&" : "?"}${FOLDER_PARAM}=${encodeURIComponent(folderId)}`
}
