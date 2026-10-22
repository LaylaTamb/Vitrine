import { describe, expect, it } from "vitest"

import {
  destinationOf,
  intoTargetId,
  isDropTargetId,
  levelTargetId,
  readDropTarget,
} from "./drag"

describe("arrastar para mover: os alvos", () => {
  it("soltar no meio de uma pasta põe dentro dela", () => {
    const target = readDropTarget(intoTargetId("p1"))
    expect(target).toEqual({ kind: "into", folderId: "p1" })
    expect(destinationOf(target!)).toBe("p1")
  })

  it("um degrau da trilha sobe para aquele nível — a raiz também", () => {
    expect(readDropTarget(levelTargetId("p2"))).toEqual({ kind: "level", folderId: "p2" })
    expect(readDropTarget(levelTargetId(null))).toEqual({ kind: "level", folderId: null })
    // o "← Voltar" é outro alvo para o mesmo nível
    expect(levelTargetId("p2", true)).not.toBe(levelTargetId("p2"))
    expect(readDropTarget(levelTargetId("p2", true))).toEqual({ kind: "level", folderId: "p2" })
    expect(readDropTarget(levelTargetId(null, true))).toEqual({ kind: "level", folderId: null })
  })

  it("o id de um card não é alvo de mover (é reordenar)", () => {
    expect(isDropTargetId("4f1c-uuid")).toBe(false)
    expect(readDropTarget("4f1c-uuid")).toBeNull()
    expect(readDropTarget(null)).toBeNull()
    expect(isDropTargetId(intoTargetId("p1"))).toBe(true)
    expect(isDropTargetId(levelTargetId(null))).toBe(true)
    expect(readDropTarget("dentro:")).toBeNull()
  })
})
