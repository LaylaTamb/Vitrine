"use client"

import { createContext, useContext, type ReactNode } from "react"

import {
  createCategoryAction,
  createFolderAction,
  deleteCategoryAction,
  deleteFolderAction,
  moveCategoryAction,
  moveFolderAction,
  renameFolderAction,
  reorderLevelAction,
  structureImpactAction,
  updateCategoryAction,
} from "@/app/actions"
import {
  bulkDeleteEntriesAction,
  bulkMoveEntriesAction,
  bulkTagAction,
  createEntryAction,
  createEntryFolderAction,
  deleteEntryAction,
  deleteEntryFolderAction,
  moveEntriesToFolderAction,
  moveEntryFolderAction,
  movePreviewAction,
  renameEntryFolderAction,
  reorderEntriesAction,
  reorderEntryFoldersAction,
  updateEntryAction,
} from "@/app/categoria/[categoryId]/actions"
import {
  applyTagToEntriesAction,
  createTagAction,
  deleteTagAction,
  searchEntriesForTagAction,
  updateTagAction,
} from "@/app/tags/actions"
import type { VitrineActions } from "@/lib/actions/contracts"

/** As Server Actions de verdade, na forma do contrato. */
const serverActions: VitrineActions = {
  createFolder: createFolderAction,
  renameFolder: renameFolderAction,
  moveFolder: moveFolderAction,
  deleteFolder: deleteFolderAction,
  reorderLevel: reorderLevelAction,

  createCategory: createCategoryAction,
  updateCategory: updateCategoryAction,
  moveCategory: moveCategoryAction,
  deleteCategory: deleteCategoryAction,
  structureImpact: structureImpactAction,

  createEntryFolder: createEntryFolderAction,
  renameEntryFolder: renameEntryFolderAction,
  moveEntryFolder: moveEntryFolderAction,
  deleteEntryFolder: deleteEntryFolderAction,
  reorderEntryFolders: reorderEntryFoldersAction,
  moveEntriesToFolder: moveEntriesToFolderAction,

  createEntry: createEntryAction,
  updateEntry: updateEntryAction,
  deleteEntry: deleteEntryAction,
  reorderEntries: reorderEntriesAction,
  bulkDeleteEntries: bulkDeleteEntriesAction,
  bulkTag: bulkTagAction,
  movePreview: movePreviewAction,
  bulkMoveEntries: bulkMoveEntriesAction,

  createTag: createTagAction,
  updateTag: updateTagAction,
  deleteTag: deleteTagAction,
  searchEntriesForTag: searchEntriesForTagAction,
  applyTagToEntries: applyTagToEntriesAction,
}

export interface VitrineRuntime {
  /** Para onde vai cada escrita. */
  actions: VitrineActions
  /** Prefixo de todo link interno: `""` no app, `"/demo"` na demonstração. */
  basePath: string
  /** Demonstração em memória: nada é gravado, tudo some no F5. */
  isDemo: boolean
}

/**
 * O padrão é o app de verdade — nenhuma página do app precisa de provider.
 * Só `/demo` embrulha a árvore num `VitrineProvider` com o acervo em memória.
 */
const VitrineContext = createContext<VitrineRuntime>({
  actions: serverActions,
  basePath: "",
  isDemo: false,
})

export function VitrineProvider({
  value,
  children,
}: {
  value: VitrineRuntime
  children: ReactNode
}) {
  return <VitrineContext.Provider value={value}>{children}</VitrineContext.Provider>
}

export function useVitrine(): VitrineRuntime {
  return useContext(VitrineContext)
}
