"use client"


import {
  createCategoryAction,
  createFolderAction,
  deleteCategoryAction,
  deleteFolderAction,
  moveCategoryAction,
  moveFolderAction,
  renameFolderAction,
  reorderLevelAction,
  setCategoryVisibilityAction,
  setFolderVisibilityAction,
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
import { setFavoriteEntryAction, setFavoritesTabAction } from "@/app/favoritos/actions"
import {
  geocodeAddressAction,
  geocodeEntryLocationsAction,
  geocodePendingLocationsAction,
  placeDetailsAction,
  routeTimesAction,
} from "@/app/mapa/actions"
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

  setFolderVisibility: setFolderVisibilityAction,
  setCategoryVisibility: setCategoryVisibilityAction,

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

  setFavoriteEntry: setFavoriteEntryAction,
  setFavoritesTab: setFavoritesTabAction,

  geocodeEntryLocations: geocodeEntryLocationsAction,
  geocodePendingLocations: geocodePendingLocationsAction,
  geocodeAddress: geocodeAddressAction,
  placeDetails: placeDetailsAction,
  routeTimes: routeTimesAction,

  createTag: createTagAction,
  updateTag: updateTagAction,
  deleteTag: deleteTagAction,
  searchEntriesForTag: searchEntriesForTagAction,
  applyTagToEntries: applyTagToEntriesAction,
}

export interface VitrineRuntime {
  /** Para onde vai cada escrita: as Server Actions. */
  actions: VitrineActions
}

const runtime: VitrineRuntime = { actions: serverActions }

/** As escritas do app, num objeto só (checado contra `VitrineActions`). */
export function useVitrine(): VitrineRuntime {
  return runtime
}
