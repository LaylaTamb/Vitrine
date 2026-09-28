"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { FOLDER_PARAM } from "@/lib/navigation"

/**
 * A pasta aberta mora na URL (`?pasta=<id>`): F5 volta para o mesmo lugar e o
 * botão voltar do navegador sobe de nível.
 *
 * Trocar de pasta usa `history.pushState`, não `router.push`: o Next integra
 * o pushState nativo ao `useSearchParams` (a tela reage), mas não re-executa
 * o Server Component — navegar entre níveis continua sem ida ao servidor,
 * como já era antes.
 */
export function useFolderParam(): [string | null, (folderId: string | null) => void] {
  const searchParams = useSearchParams()
  const current = searchParams.get(FOLDER_PARAM) || null

  const setFolder = useCallback((folderId: string | null) => {
    const url = new URL(window.location.href)
    if (folderId) url.searchParams.set(FOLDER_PARAM, folderId)
    else url.searchParams.delete(FOLDER_PARAM)
    if (url.toString() === window.location.href) return
    window.history.pushState(null, "", url.toString())
  }, [])

  return [current, setFolder]
}
