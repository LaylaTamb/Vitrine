/**
 * Subpastas dentro de uma categoria: o que aparece em cada nível, quanto cada
 * subpasta contém e para onde uma subpasta sobe quando é excluída mantendo o
 * conteúdo. A árvore em si (filhas, descendentes, trilha, destinos de
 * "mover") é a mesma das Coleções — ver `collections.ts`.
 */

import { descendantFolderIds } from "./collections"
import type { EntryFolder } from "./types"

export interface EntryFolderTotals {
  /** Subpastas diretas. */
  folders: number
  /** Itens na pasta e em todas as subpastas, em qualquer profundidade. */
  entries: number
}

/** Qualquer coisa que diga em qual subpasta está: `EntryView` ou linha do banco. */
interface InFolder {
  folderId: string | null
}

/** Itens soltos exatamente numa pasta (`null` = raiz da categoria). */
export function itemsAt<T extends InFolder>(items: T[], folderId: string | null): T[] {
  return items.filter((item) => (item.folderId ?? null) === folderId)
}

/**
 * Quanto cada subpasta contém — é o subtítulo do card ("2 subpastas · 12
 * itens") e o aviso do diálogo de excluir.
 */
export function entryFolderTotals(
  folders: EntryFolder[],
  items: InFolder[]
): Map<string, EntryFolderTotals> {
  const totals = new Map<string, EntryFolderTotals>()
  for (const folder of folders) totals.set(folder.id, { folders: 0, entries: 0 })

  for (const folder of folders) {
    const parent = folder.parent_folder_id
    const bucket = parent ? totals.get(parent) : undefined
    if (bucket) bucket.folders += 1
  }

  // Cada item soma para a própria pasta e para todas as ancestrais.
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parent_folder_id]))
  for (const item of items) {
    let cursor = item.folderId
    const guard = new Set<string>()
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor)
      const bucket = totals.get(cursor)
      if (bucket) bucket.entries += 1
      cursor = parentOf.get(cursor) ?? null
    }
  }

  return totals
}

/**
 * A pasta pedida na URL, se ela ainda existir nesta categoria — senão a raiz.
 * Protege contra link velho de uma subpasta que foi excluída.
 */
export function resolveFolderId(folders: EntryFolder[], folderId: string | null): string | null {
  if (!folderId) return null
  return folders.some((folder) => folder.id === folderId) ? folderId : null
}

/**
 * Tudo que uma exclusão de subpasta alcança: a própria pasta e as
 * descendentes. É o conjunto que some junto em "excluir tudo".
 */
export function folderSubtree(folders: EntryFolder[], folderId: string): Set<string> {
  const ids = descendantFolderIds(folders, folderId)
  ids.add(folderId)
  return ids
}
