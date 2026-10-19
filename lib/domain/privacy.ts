/**
 * Privacidade das coleções: pasta e categoria podem ser públicas (o grupo
 * vê) ou privadas (só o dono). Quem garante é o banco (RLS, migração 12);
 * aqui fica só o que a TELA do dono precisa saber para explicar o estado.
 */

import type { Folder, Profile } from "./types"

/** Linha sem a coluna (antes da migração 12) conta como pública — o comportamento de sempre. */
export function isPublic(row: { is_public?: boolean | null } | null | undefined): boolean {
  return row?.is_public !== false
}

/** O padrão de quem cria: públicas, a não ser que o perfil diga o contrário. */
export function defaultPublicOf(profile: Pick<Profile, "default_public"> | null | undefined): boolean {
  return profile?.default_public !== false
}

/**
 * A primeira pasta privada no caminho até a raiz, começando pela própria
 * `folderId`. É ela que esconde tudo o que está dentro — mesmo uma categoria
 * marcada como pública. `null` = nenhuma: o caminho é todo público.
 */
export function privateAncestor(
  folders: Pick<Folder, "id" | "name" | "parent_folder_id" | "is_public">[],
  folderId: string | null
): Pick<Folder, "id" | "name"> | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const seen = new Set<string>()
  let cursor = folderId
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const folder = byId.get(cursor)
    if (!folder) return null
    if (!isPublic(folder)) return folder
    cursor = folder.parent_folder_id
  }
  return null
}

/** A frase do estado, para o botão e o leitor de tela. */
export function visibilityLabel(kind: "folder" | "category", isPublicNow: boolean): string {
  const noun = kind === "folder" ? "Pasta" : "Categoria"
  return isPublicNow
    ? `${noun} pública: quem tem acesso ao app vê`
    : `${noun} privada: só você vê`
}
