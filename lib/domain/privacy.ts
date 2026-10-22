/**
 * Privacidade das coleções: pasta e categoria têm um de três níveis —
 * Pública (qualquer pessoa vê, mesmo sem conta), Amigos (quem se segue
 * mutuamente com o dono) ou Privada (só o dono). Vale o nível mais restrito
 * no caminho de pastas. Quem garante é o banco (RLS, migração 14); aqui fica
 * só o que a TELA do dono precisa saber para explicar o estado.
 */

import type { Category, Folder, Profile } from "./types"

/** Do mais aberto ao mais fechado — também é a ordem do seletor. */
export const VISIBILITIES = ["public", "friends", "private"] as const

export type Visibility = (typeof VISIBILITIES)[number]

/**
 * "Amigos" no seletor: ligado desde que existe o botão Seguir (Fase 3). O
 * banco entende o nível desde a migração 14. Desligar esconde a opção de novo
 * (menos para quem já está nesse nível).
 */
export const FRIENDS_VISIBILITY_ENABLED = true

const RANK: Record<Visibility, number> = { public: 0, friends: 1, private: 2 }

/** O erro de gravar a visibilidade antes de a migração 14 rodar. */
export const VISIBILITY_NOT_READY =
  "A visibilidade ainda não está no banco: rode supabase/14_visibility_and_follows.sql no SQL Editor do Supabase (antes dele, o 12 e o 13, se ainda não rodaram)."

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Pública",
  friends: "Amigos",
  private: "Privada",
}

export function isVisibility(value: unknown): value is Visibility {
  return typeof value === "string" && (VISIBILITIES as readonly string[]).includes(value)
}

type VisibilityRow = { visibility?: string | null; is_public?: boolean | null }

/**
 * O nível de uma pasta ou categoria. Antes da migração 14 só existe
 * `is_public` (12); antes da 12, nada — e tudo é público, como sempre foi.
 */
export function visibilityOf(row: VisibilityRow | null | undefined): Visibility {
  if (isVisibility(row?.visibility)) return row.visibility
  return row?.is_public === false ? "private" : "public"
}

/**
 * O nível que o backup leva: só quando o banco já guarda um (`visibility`
 * do 14, ou `is_public` do 12). Antes do 12 não há nível nenhum, e o arquivo
 * sai sem ele — quem importar fica com o próprio padrão.
 */
export function storedVisibility(row: VisibilityRow | null | undefined): Visibility | undefined {
  if (!row || (!("visibility" in row) && !("is_public" in row))) return undefined
  return visibilityOf(row)
}

/** O padrão de quem cria: públicas, a não ser que o perfil diga outra coisa. */
export function defaultVisibilityOf(
  profile: Pick<Profile, "default_visibility" | "default_public"> | null | undefined
): Visibility {
  if (isVisibility(profile?.default_visibility)) return profile.default_visibility
  return profile?.default_public === false ? "private" : "public"
}

/** O que fecha mais dos dois. */
export function mostRestrictive(a: Visibility, b: Visibility): Visibility {
  return RANK[b] > RANK[a] ? b : a
}

/** As opções do seletor. "Amigos" fica escondida até a Fase 3 — a não ser que já seja o nível atual. */
export function visibilityOptions(current?: Visibility): Visibility[] {
  return VISIBILITIES.filter(
    (option) => option !== "friends" || FRIENDS_VISIBILITY_ENABLED || option === current
  )
}

type FolderLike = Pick<Folder, "id" | "name" | "parent_folder_id"> & VisibilityRow

export interface RestrictingFolder {
  folder: Pick<Folder, "id" | "name">
  visibility: Visibility
}

/**
 * A pasta mais restrita no caminho até a raiz, começando pela própria
 * `folderId` — mas só se ela fechar mais do que `than`: é ela que, na
 * prática, limita quem vê o que está dentro. No empate, a mais próxima.
 * `null` = o caminho não fecha nada além de `than`.
 */
export function restrictingAncestor(
  folders: FolderLike[],
  folderId: string | null,
  than: Visibility
): RestrictingFolder | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const seen = new Set<string>()
  let best: RestrictingFolder | null = null
  let cursor = folderId
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const folder = byId.get(cursor)
    if (!folder) break
    const visibility = visibilityOf(folder)
    if (!best || RANK[visibility] > RANK[best.visibility]) {
      best = { folder: { id: folder.id, name: folder.name }, visibility }
    }
    cursor = folder.parent_folder_id
  }
  return best && RANK[best.visibility] > RANK[than] ? best : null
}

/** O nível que vale de fato: o da própria linha ou o de uma pasta acima, o que fechar mais. */
export function effectiveVisibility(
  own: Visibility,
  folders: FolderLike[],
  folderId: string | null
): Visibility {
  return restrictingAncestor(folders, folderId, own)?.visibility ?? own
}

/** A frase do estado, para o seletor e o leitor de tela. */
export function visibilityLabel(kind: "folder" | "category", visibility: Visibility): string {
  const noun = kind === "folder" ? "Pasta" : "Categoria"
  switch (visibility) {
    case "public":
      return `${noun} pública: qualquer pessoa vê, mesmo sem conta`
    case "friends":
      return `${noun} só para amigos: quem você segue e segue você de volta`
    case "private":
      return `${noun} privada: só você vê`
  }
}

/** A explicação embaixo do seletor, na hora de criar. */
export function visibilityHint(kind: "folder" | "category", visibility: Visibility): string {
  if (kind === "folder") {
    switch (visibility) {
      case "public":
        return "Qualquer pessoa vê a pasta e o que for público dentro dela, mesmo sem conta no Vitrine."
      case "friends":
        return "Só seus amigos (quem você segue e segue você de volta) veem a pasta e o que estiver dentro dela."
      case "private":
        return "Só você vê a pasta e tudo o que estiver dentro dela."
    }
  }
  switch (visibility) {
    case "public":
      return "Qualquer pessoa vê a categoria e os itens dela, mesmo sem conta no Vitrine."
    case "friends":
      return "Só seus amigos (quem você segue e segue você de volta) veem a categoria e os itens dela."
    case "private":
      return "Só você vê a categoria e os itens dela."
  }
}

/** O aviso de quando uma pasta acima fecha mais do que o nível escolhido aqui. */
export function restrictionNote(kind: "folder" | "category", by: RestrictingFolder): string {
  const where =
    kind === "folder"
      ? `Esta pasta está dentro de “${by.folder.name}”`
      : `Esta categoria está dentro de “${by.folder.name}”`
  const what = kind === "folder" ? "o que tem aqui" : "os itens dela"
  return by.visibility === "private"
    ? `${where}, que é privada: ninguém mais vê ${what}.`
    : `${where}, que é só para amigos: só seus amigos veem ${what}.`
}

/**
 * O aviso único de que "Pública" passou a querer dizer "na internet": para
 * quem ainda não viu e tem pelo menos uma categoria pública de fato (nenhuma
 * pasta acima fechando). Antes da migração 14 a coluna não existe e a regra
 * nova ainda não vale: sem aviso.
 */
export function needsPublicNotice(
  profile: Pick<Profile, "public_notice_seen_at"> | null | undefined,
  categories: (Pick<Category, "folder_id"> & VisibilityRow)[],
  folders: FolderLike[]
): boolean {
  if (!profile || profile.public_notice_seen_at !== null) return false
  return categories.some(
    (category) =>
      effectiveVisibility(visibilityOf(category), folders, category.folder_id) === "public"
  )
}
