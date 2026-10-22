/**
 * Arrastar para mover: além de reordenar (soltar perto de outro card), dá para
 * soltar **dentro de uma pasta** (no meio do card dela) ou **num degrau da
 * trilha** do topo (sobe para aquele nível). Cada alvo tem um id próprio, que
 * não se confunde com o id de um card.
 */

const INTO = "dentro:"
const LEVEL = "nivel:"
const ROOT = "raiz"
/** O "← Voltar" é outro alvo para o mesmo nível do degrau anterior. */
const BACK_SUFFIX = "#voltar"

export type DropTarget =
  | { kind: "into"; folderId: string }
  | { kind: "level"; folderId: string | null }

/** O miolo do card de uma pasta: soltar ali põe dentro dela. */
export function intoTargetId(folderId: string): string {
  return `${INTO}${folderId}`
}

/** Um degrau da trilha: `null` = a raiz (das Coleções, ou da categoria). */
export function levelTargetId(folderId: string | null, back = false): string {
  return `${LEVEL}${folderId ?? ROOT}${back ? BACK_SUFFIX : ""}`
}

/** O id é de um alvo de mover (e não de um card para reordenar)? */
export function isDropTargetId(id: string | number): boolean {
  const text = String(id)
  return text.startsWith(INTO) || text.startsWith(LEVEL)
}

/** Lê o alvo de um id; `null` = é um card (reordenar). */
export function readDropTarget(id: string | number | null | undefined): DropTarget | null {
  if (id === null || id === undefined) return null
  const text = String(id)
  if (text.startsWith(INTO)) {
    const folderId = text.slice(INTO.length)
    return folderId ? { kind: "into", folderId } : null
  }
  if (text.startsWith(LEVEL)) {
    const raw = text.slice(LEVEL.length).replace(BACK_SUFFIX, "")
    if (!raw) return null
    return { kind: "level", folderId: raw === ROOT ? null : raw }
  }
  return null
}

/** Para onde vai, em id de pasta (`null` = raiz) — o "into" e o "level" dão no mesmo. */
export function destinationOf(target: DropTarget): string | null {
  return target.folderId
}
