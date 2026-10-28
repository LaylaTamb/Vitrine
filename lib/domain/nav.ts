/**
 * A navegação do app logado: 5 lugares (Início, Descobrir, Match, Avisos e o
 * Perfil), o QR de amizade e as Configurações. Aqui só a regra de qual fica
 * aceso em cada endereço — a barra lateral e a de baixo usam a mesma.
 */

export type NavSection = "inicio" | "descobrir" | "match" | "avisos" | "perfil" | "qr" | "config"

const STARTS: [string, NavSection][] = [
  ["/inicio", "inicio"],
  ["/explorar", "descobrir"],
  ["/usuarios", "descobrir"],
  ["/matches", "match"],
  ["/avisos", "avisos"],
  ["/configuracoes", "config"],
  ["/lixeira", "config"],
  ["/importar", "config"],
  ["/tags", "config"],
  ["/qr", "qr"],
  // O que é seu: categorias, itens, salvar algo novo.
  ["/categoria", "perfil"],
  ["/compartilhar", "perfil"],
]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Qual lugar fica aceso. O seu perfil (`/v/<seu @>`, e `/`, que abre nele) é
 * Perfil; o de outra pessoa, Descobrir (foi lá que você a achou). Fora daqui,
 * nenhum.
 */
export function navSectionOf(pathname: string, username: string): NavSection | null {
  if (pathname === "/") return "perfil"
  if (under(pathname.toLowerCase(), `/v/${username.toLowerCase()}`)) return "perfil"
  if (under(pathname, "/v")) return "descobrir"
  for (const [prefix, section] of STARTS) {
    if (under(pathname, prefix)) return section
  }
  return null
}
