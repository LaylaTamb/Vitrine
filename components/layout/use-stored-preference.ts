"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Uma preferência deste aparelho (modo de exibição, tamanho da grade…),
 * guardada no `localStorage`.
 *
 * O primeiro render usa sempre `fallback` — é o que o HTML do servidor tem —
 * e o valor salvo só entra num efeito, depois da hidratação. Storage
 * bloqueado (modo privado) ou valor que `parse` recusa (`null`): fica o
 * padrão. `parse` precisa ser estável (uma função de módulo), senão o efeito
 * roda a cada render.
 */
export function useStoredPreference<T extends string>(
  key: string,
  fallback: T,
  parse: (raw: string | null) => T | null
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback)

  useEffect(() => {
    try {
      const stored = parse(window.localStorage.getItem(key))
      if (stored !== null) setValue(stored)
    } catch {
      // storage bloqueado: segue no padrão
    }
  }, [key, parse])

  const change = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // idem
      }
    },
    [key]
  )

  return [value, change]
}
