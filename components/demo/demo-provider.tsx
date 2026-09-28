"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"

import { VitrineProvider, type VitrineRuntime } from "@/components/providers/vitrine-context"
import { DEMO_BASE_PATH } from "@/lib/demo/config"
import { getSeedPayload } from "@/lib/demo/seed"
import { buildDemoState, type DemoState } from "@/lib/demo/state"
import { createDemoActions, type DemoStore } from "@/lib/demo/store"

interface DemoData {
  state: DemoState
  /** Volta ao acervo de exemplo, sem precisar de F5. */
  reset: () => void
}

const DemoDataContext = createContext<DemoData | null>(null)

let initialState: DemoState | null = null

/** O acervo de exemplo, montado uma vez só. O estado nunca é mutado, então dá para reusar. */
function seedState(): DemoState {
  initialState ??= buildDemoState(getSeedPayload())
  return initialState
}

/**
 * O acervo da demonstração mora aqui, no estado do React: sobrevive à
 * navegação entre as páginas de `/demo` (o layout não desmonta) e some no F5.
 * Nada vai para a rede.
 *
 * Os componentes do app não sabem disso: recebem, pelo `VitrineProvider`, um
 * `actions` com a mesma forma das Server Actions.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(seedState)

  // O `store` lê do ref, não do estado: duas escritas seguidas no mesmo tick
  // (ex.: criar tag e já salvar o item) enxergam uma a outra.
  const stateRef = useRef(state)
  const store = useMemo<DemoStore>(
    () => ({
      get: () => stateRef.current,
      set: (next) => {
        stateRef.current = next
        setState(next)
      },
    }),
    []
  )

  const runtime = useMemo<VitrineRuntime>(
    () => ({ actions: createDemoActions(store), basePath: DEMO_BASE_PATH, isDemo: true }),
    [store]
  )

  const reset = useCallback(() => store.set(seedState()), [store])
  const data = useMemo(() => ({ state, reset }), [state, reset])

  return (
    <DemoDataContext.Provider value={data}>
      <VitrineProvider value={runtime}>{children}</VitrineProvider>
    </DemoDataContext.Provider>
  )
}

export function useDemoData(): DemoData {
  const data = useContext(DemoDataContext)
  if (!data) throw new Error("useDemoData() só funciona dentro de /demo (DemoProvider).")
  return data
}
