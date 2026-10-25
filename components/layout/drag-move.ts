"use client"

import {
  closestCenter,
  PointerSensor,
  pointerWithin,
  type CollisionDetection,
  type PointerSensorOptions,
} from "@dnd-kit/core"
import type { SortingStrategy } from "@dnd-kit/sortable"
import type { PointerEvent as ReactPointerEvent } from "react"

import { intoTargetId, isDropTargetId } from "@/lib/domain/drag"

/**
 * O PointerSensor de sempre, menos o dedo num `[data-hold-drag]` (os chips de
 * subpasta, numa fileira que rola de lado): ali quem arrasta é o TouchSensor,
 * depois de segurar — senão rolar a fileira viraria arrastar um chip.
 */
export class HandlePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: ReactPointerEvent,
        { onActivation }: PointerSensorOptions
      ) => {
        if (!event.isPrimary || event.button !== 0) return false
        const target = event.target instanceof Element ? event.target : null
        if (event.pointerType === "touch" && target?.closest("[data-hold-drag]")) return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}

type SortableData = { sortable?: { containerId?: string } } | undefined

/**
 * Onde o card arrastado cai: se o dedo (ou o mouse) está sobre um alvo de
 * mover — o miolo de uma pasta, um degrau da trilha —, é ele; senão, o card
 * mais perto **do mesmo grupo** (itens com itens, pastas com pastas), para
 * reordenar. A pasta arrastada nunca é alvo dela mesma.
 */
export const moveCollision: CollisionDetection = (args) => {
  const activeId = String(args.active.id)
  const targets = args.droppableContainers.filter(
    (container) => isDropTargetId(container.id) && container.id !== intoTargetId(activeId)
  )
  const hits = pointerWithin({ ...args, droppableContainers: targets })
  if (hits.length > 0) return hits

  const group = (args.active.data.current as SortableData)?.sortable?.containerId
  const siblings = args.droppableContainers.filter(
    (container) =>
      !isDropTargetId(container.id) &&
      (container.data.current as SortableData)?.sortable?.containerId === group
  )
  return closestCenter({ ...args, droppableContainers: siblings })
}

/**
 * Para quando dá para mover, mas não para reordenar (fora da ordem manual): os
 * outros cards ficam parados enquanto arrasta.
 */
export const noShiftStrategy: SortingStrategy = () => null
