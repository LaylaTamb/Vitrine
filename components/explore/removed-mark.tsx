import { Unlink } from "lucide-react"

/**
 * A marca de um item de cópia ligada cujo original o autor apagou: o seu
 * continua aqui, só não recebe mais nada (migração 26).
 */
export function RemovedMark() {
  return (
    <span title="Removido do original" className="inline-flex shrink-0 items-center text-faint">
      <Unlink aria-hidden className="size-3.5" />
      <span className="sr-only">Removido do original</span>
    </span>
  )
}
