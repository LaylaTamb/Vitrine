/**
 * A árvore de Coleções: o que aparece em cada nível, quanto cada pasta contém
 * somando tudo o que está abaixo dela, e para onde uma pasta pode ser movida.
 */

import type { Category, Folder } from "./types"

export interface FolderTotals {
  /** Categorias diretamente na pasta e em todas as subpastas. */
  categories: number
  /** Itens dessas categorias. */
  entries: number
  /** Subpastas diretas. */
  folders: number
}

/** Filhas diretas de uma pasta (`null` = raiz das Coleções). */
export function foldersOf(folders: Folder[], parentId: string | null): Folder[] {
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
export function descendantFolderIds(folders: Folder[], folderId: string): Set<string> {
  const byParent = new Map<string | null, Folder[]>()
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
export function breadcrumbOf(folders: Folder[], folderId: string | null): Folder[] {
  if (!folderId) return []
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const trail: Folder[] = []
  const guard = new Set<string>()
  let cursor: string | null = folderId

  while (cursor && !guard.has(cursor)) {
    guard.add(cursor)
    const folder: Folder | undefined = byId.get(cursor)
    if (!folder) break
    trail.unshift(folder)
    cursor = folder.parent_folder_id ?? null
  }

  return trail
}

/** Caminho completo de cada pasta, para o `<select>` do diálogo de mover. */
export function folderPathLabel(folders: Folder[], folderId: string): string {
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
export function moveTargets(folders: Folder[], movingFolderId?: string | null): MoveTarget[] {
  const blocked = new Set<string>()
  if (movingFolderId) {
    blocked.add(movingFolderId)
    for (const id of descendantFolderIds(folders, movingFolderId)) blocked.add(id)
  }

  const targets: MoveTarget[] = [{ id: null, label: "Raiz das Coleções" }]
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
