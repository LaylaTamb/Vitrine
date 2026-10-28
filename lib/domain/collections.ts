/**
 * A árvore de Coleções: o que aparece em cada nível, quanto cada pasta contém
 * somando tudo o que está abaixo dela, e para onde uma pasta pode ser movida.
 */

import type { Category, Folder } from "./types"

/**
 * O mínimo que uma pasta precisa ter para virar árvore. Vale tanto para as
 * pastas das Coleções (`Folder`) quanto para as subpastas de dentro de uma
 * categoria (`EntryFolder`) — as funções de árvore abaixo servem às duas.
 */
export interface TreeFolder {
  id: string
  name: string
  parent_folder_id: string | null
  display_order: number
}

export interface FolderTotals {
  /** Categorias diretamente na pasta e em todas as subpastas. */
  categories: number
  /** Itens dessas categorias. */
  entries: number
  /** Subpastas diretas. */
  folders: number
}

/** Filhas diretas de uma pasta (`null` = raiz das Coleções). */
export function foldersOf<T extends TreeFolder>(folders: T[], parentId: string | null): T[] {
  return folders
    .filter((folder) => (folder.parent_folder_id ?? null) === parentId)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"))
}

/** Categorias diretamente dentro de uma pasta (`null` = raiz). */
export function categoriesOf(categories: Category[], folderId: string | null): Category[] {
  return categories
    .filter((category) => (category.folder_id ?? null) === folderId)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"))
}

/** Todas as pastas abaixo de uma pasta, em qualquer profundidade. */
export function descendantFolderIds(folders: TreeFolder[], folderId: string): Set<string> {
  const byParent = new Map<string | null, TreeFolder[]>()
  for (const folder of folders) {
    const key = folder.parent_folder_id ?? null
    const list = byParent.get(key) ?? []
    list.push(folder)
    byParent.set(key, list)
  }

  const out = new Set<string>()
  const queue = [folderId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    for (const child of byParent.get(current) ?? []) {
      if (out.has(child.id)) continue
      out.add(child.id)
      queue.push(child.id)
    }
  }
  return out
}

/**
 * Quanto cada pasta contém, contando tudo que está abaixo dela — é o subtítulo
 * do card de pasta ("2 categorias · 37 itens") e o aviso do diálogo de excluir.
 */
export function folderTotals(
  folders: Folder[],
  categories: Category[],
  entryCounts: Map<string, number> | Record<string, number>
): Map<string, FolderTotals> {
  const countOf = (categoryId: string): number =>
    entryCounts instanceof Map
      ? (entryCounts.get(categoryId) ?? 0)
      : (entryCounts[categoryId] ?? 0)

  const totals = new Map<string, FolderTotals>()
  for (const folder of folders) {
    totals.set(folder.id, { categories: 0, entries: 0, folders: 0 })
  }

  for (const folder of folders) {
    const parent = folder.parent_folder_id
    if (parent && totals.has(parent)) {
      const current = totals.get(parent)
      if (current) current.folders += 1
    }
  }

  // Cada categoria soma para a própria pasta e para todas as ancestrais.
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  for (const category of categories) {
    let cursor = category.folder_id
    const entries = countOf(category.id)
    const guard = new Set<string>()
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor)
      const bucket = totals.get(cursor)
      if (bucket) {
        bucket.categories += 1
        bucket.entries += entries
      }
      cursor = byId.get(cursor)?.parent_folder_id ?? null
    }
  }

  return totals
}

/** A trilha até a pasta atual: `Coleções / Pai / Filho`. */
export function breadcrumbOf<T extends TreeFolder>(folders: T[], folderId: string | null): T[] {
  if (!folderId) return []
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const trail: T[] = []
  const guard = new Set<string>()
  let cursor: string | null = folderId

  while (cursor && !guard.has(cursor)) {
    guard.add(cursor)
    const folder: T | undefined = byId.get(cursor)
    if (!folder) break
    trail.unshift(folder)
    cursor = folder.parent_folder_id ?? null
  }

  return trail
}

/** Caminho completo de cada pasta, para o `<select>` do diálogo de mover. */
export function folderPathLabel(folders: TreeFolder[], folderId: string): string {
  return breadcrumbOf(folders, folderId)
    .map((folder) => folder.name)
    .join("/")
}

export interface MoveTarget {
  id: string | null
  label: string
}

/**
 * Destinos possíveis de um "mover". Uma pasta não pode ir para dentro de si
 * mesma nem de uma descendente — essas opções somem da lista.
 */
export function moveTargets(
  folders: TreeFolder[],
  movingFolderId?: string | null,
  rootLabel = "Raiz das Coleções"
): MoveTarget[] {
  const blocked = new Set<string>()
  if (movingFolderId) {
    blocked.add(movingFolderId)
    for (const id of descendantFolderIds(folders, movingFolderId)) blocked.add(id)
  }

  const targets: MoveTarget[] = [{ id: null, label: rootLabel }]
  const sorted = [...folders].sort((a, b) =>
    folderPathLabel(folders, a.id).localeCompare(folderPathLabel(folders, b.id), "pt-BR")
  )

  for (const folder of sorted) {
    if (blocked.has(folder.id)) continue
    targets.push({ id: folder.id, label: folderPathLabel(folders, folder.id) })
  }

  return targets
}

/**
 * Um nível das Coleções, com pastas e categorias na MESMA sequência de
 * `display_order` — é assim que o drag-and-drop trata os dois juntos.
 */
export type LevelItem =
  | { kind: "folder"; id: string; order: number; folder: Folder }
  | { kind: "category"; id: string; order: number; category: Category }

export function levelItems(
  folders: Folder[],
  categories: Category[],
  folderId: string | null
): LevelItem[] {
  const items: LevelItem[] = [
    ...foldersOf(folders, folderId).map(
      (folder): LevelItem => ({
        kind: "folder",
        id: folder.id,
        order: folder.display_order,
        folder,
      })
    ),
    ...categoriesOf(categories, folderId).map(
      (category): LevelItem => ({
        kind: "category",
        id: category.id,
        order: category.display_order,
        category,
      })
    ),
  ]

  // Empate no display_order: pasta antes de categoria.
  return items.sort(
    (a, b) => a.order - b.order || (a.kind === b.kind ? 0 : a.kind === "folder" ? -1 : 1)
  )
}

/**
 * Aplica uma ordem otimista (a lista de ids depois de um arraste) sobre a
 * lista que veio do servidor. Item que não está na ordem (chegou depois) vai
 * para o fim, na ordem original.
 */
export function applyOrder<T extends { id: string }>(items: T[], ids: string[] | null): T[] {
  if (!ids) return items
  const position = new Map(ids.map((id, index) => [id, index]))
  return [...items].sort(
    (a, b) =>
      (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
}

// ---------------------------------------------------------------------------
// Capas dos cards (migração 40)
// ---------------------------------------------------------------------------

/** As linhas da view `category_covers` → até 3 imagens por categoria, na ordem. */
export function coversByCategory(
  rows: { category_id: string; image_url: string | null; position: number }[]
): Record<string, string[]> {
  const covers: Record<string, string[]> = {}
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    if (!row.image_url?.trim()) continue
    const list = (covers[row.category_id] ??= [])
    if (list.length < 3) list.push(row.image_url)
  }
  return covers
}

/** O que a capa de uma pasta mostra: os ícones do que está dentro (subpastas primeiro). */
export function folderGlyphs(
  folders: Pick<TreeFolder, "parent_folder_id">[],
  categories: Pick<Category, "folder_id" | "icon">[],
  folderId: string,
  max = 4
): string[] {
  const inside = [
    ...folders.filter((folder) => folder.parent_folder_id === folderId).map(() => "📁"),
    ...categories.filter((category) => category.folder_id === folderId).map((c) => c.icon || "▫"),
  ]
  return inside.slice(0, max)
}

/**
 * As cópias antigas de match (`kind` 'match', migração 31) não aparecem mais
 * em lugar nenhum das Coleções: o match mora na aba Match. Some também a
 * pasta "Matches" da raiz que só tinha cópias. (O SQL 46 apaga as duas de vez.)
 */
export function withoutMatchCopies<
  F extends { id: string; name: string; parent_folder_id: string | null },
  C extends { folder_id: string | null; kind?: string | null },
>(
  folders: F[],
  categories: C[]
): { folders: F[]; categories: C[] } {
  const kept = categories.filter((category) => category.kind !== "match")
  const emptyMatches = new Set(
    folders
      .filter(
        (folder) =>
          folder.parent_folder_id === null &&
          folder.name.trim().toLowerCase() === "matches" &&
          categories.some(
            (category) => category.kind === "match" && category.folder_id === folder.id
          ) &&
          !kept.some((category) => category.folder_id === folder.id) &&
          !folders.some((child) => child.parent_folder_id === folder.id)
      )
      .map((folder) => folder.id)
  )
  return { folders: folders.filter((folder) => !emptyMatches.has(folder.id)), categories: kept }
}
