/**
 * A navegação do app logado: 5 lugares (Início, Descobrir, Match, Avisos e o
 * Perfil) e as Configurações. Aqui só a regra de qual fica aceso em cada
 * endereço — a barra lateral e a de baixo usam a mesma.
 */

export type NavSection = "inicio" | "descobrir" | "match" | "avisos" | "perfil" | "config"

const STARTS: [string, NavSection][] = [
  ["/explorar", "descobrir"],
  ["/usuarios", "descobrir"],
  ["/matches", "match"],
  ["/avisos", "avisos"],
  ["/configuracoes", "config"],
  ["/lixeira", "config"],
  ["/importar", "config"],
  ["/tags", "config"],
  // O que é seu: categorias, itens, o QR, salvar algo novo.
  ["/categoria", "perfil"],
  ["/qr", "perfil"],
  ["/compartilhar", "perfil"],
]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Qual lugar fica aceso. O seu perfil (`/v/<seu @>`) é Perfil; o de outra
 * pessoa, Descobrir (foi lá que você a achou). Fora daqui, nenhum.
 */
export function navSectionOf(pathname: string, username: string): NavSection | null {
  if (pathname === "/") return "inicio"
  if (under(pathname.toLowerCase(), `/v/${username.toLowerCase()}`)) return "perfil"
  if (under(pathname, "/v")) return "descobrir"
  for (const [prefix, section] of STARTS) {
    if (under(pathname, prefix)) return section
  }
  return null
}
