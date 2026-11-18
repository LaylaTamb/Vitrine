"use client"

import { useEffect, useRef } from "react"

import { EntryImage } from "@/components/entry/entry-image"
import type { ImageDisplay } from "@/lib/domain/types"
import { coverOverflow, imageStyleOf, panFraming, zoomFraming } from "@/lib/domain/view"

type Framing = Required<ImageDisplay>
type Point = { x: number; y: number }

/** Passo do teclado: 5% do quadro por seta, 20% de zoom por + ou −. */
const KEY_PAN = 0.05
const KEY_ZOOM = 1.2

/** O tamanho do quadro na tela e quanto a imagem sobra dele com `cover`. */
function geometryOf(frame: HTMLElement) {
  const rect = frame.getBoundingClientRect()
  const img = frame.querySelector("img")
  const ratio = img && img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 0
  return { rect, overflow: coverOverflow(ratio, rect.width / rect.height) }
}

/** Um ponto da tela em fração do quadro (0–1). */
function pointIn(rect: DOMRect, point: Point): Point {
  return { x: (point.x - rect.left) / rect.width, y: (point.y - rect.top) / rect.height }
}

/**
 * O enquadramento da imagem do item, como num visualizador de imagens:
 * arrastar move, a roda do mouse (ou a pinça, no trackpad e no celular) dá o
 * zoom no ponto apontado. Dá para chegar a qualquer parte da imagem. No
 * teclado, as setas movem e + / − dão o zoom.
 */
export function ImageFramer({
  imageUrl,
  initial,
  framing,
  onChange,
}: {
  imageUrl: string
  initial: string
  framing: Framing
  onChange: (framing: Framing) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  // Os eventos chegam mais rápido que a nova renderização: cada passo parte
  // do último enquadramento calculado, não do que está na tela.
  const latest = useRef(framing)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    latest.current = framing
    onChangeRef.current = onChange
  }, [framing, onChange])

  function commit(next: Framing) {
    latest.current = next
    onChangeRef.current(next)
  }

  // A roda precisa de um listener não passivo para não rolar o diálogo junto.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const { rect, overflow } = geometryOf(frame!)
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      // Com ctrl, é a pinça do trackpad: passos menores, então mais sensível.
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015))
      const at = pointIn(rect, { x: event.clientX, y: event.clientY })
      latest.current = zoomFraming(latest.current, latest.current.zoom * factor, at, overflow)
      onChangeRef.current(latest.current)
    }
    frame.addEventListener("wheel", onWheel, { passive: false })
    return () => frame.removeEventListener("wheel", onWheel)
  }, [])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const map = pointers.current
    if (!map.has(event.pointerId) || !frameRef.current) return
    const { rect, overflow } = geometryOf(frameRef.current)
    const [a, b] = [...map.values()]
    map.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const [a2, b2] = [...map.values()]

    // Um dedo (ou o mouse): arrastar.
    if (!b || !b2) {
      commit(
        panFraming(latest.current, (a2.x - a.x) / rect.width, (a2.y - a.y) / rect.height, overflow)
      )
      return
    }

    // Dois dedos: a pinça dá o zoom no meio deles, e o meio arrastando move.
    const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
    const middle = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
    const before = middle(a, b)
    const after = middle(a2, b2)
    const scale = distance(a2, b2) / Math.max(1, distance(a, b))
    const zoomed = zoomFraming(
      latest.current,
      latest.current.zoom * scale,
      pointIn(rect, after),
      overflow
    )
    commit(
      panFraming(
        zoomed,
        (after.x - before.x) / rect.width,
        (after.y - before.y) / rect.height,
        overflow
      )
    )
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!frameRef.current) return
    const { overflow } = geometryOf(frameRef.current)
    const current = latest.current
    const center = { x: 0.5, y: 0.5 }
    // As setas andam com a vista: → mostra mais da direita.
    const next =
      event.key === "ArrowLeft"
        ? panFraming(current, KEY_PAN, 0, overflow)
        : event.key === "ArrowRight"
          ? panFraming(current, -KEY_PAN, 0, overflow)
          : event.key === "ArrowUp"
            ? panFraming(current, 0, KEY_PAN, overflow)
            : event.key === "ArrowDown"
              ? panFraming(current, 0, -KEY_PAN, overflow)
              : event.key === "+" || event.key === "="
                ? zoomFraming(current, current.zoom * KEY_ZOOM, center, overflow)
                : event.key === "-" || event.key === "_"
                  ? zoomFraming(current, current.zoom / KEY_ZOOM, center, overflow)
                  : null
    if (!next) return
    event.preventDefault()
    commit(next)
  }

  return (
    <div className="mx-auto max-w-60 space-y-1.5">
      {/* O quadro não ocupa a tela toda: no celular, sobra onde tocar para rolar o formulário. */}
      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-label="Enquadramento da imagem. Setas movem; + e − dão o zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={onKeyDown}
        className="mx-auto w-full max-w-60 cursor-grab touch-none rounded-md select-none active:cursor-grabbing"
      >
        <EntryImage
          imageUrl={imageUrl}
          imageStyle={imageStyleOf(framing)}
          initial={initial}
          eager
        />
      </div>
      <p className="flex items-baseline justify-between gap-2 text-xs text-faint">
        <span className="min-w-0">Arraste para mover. Role ou faça pinça para o zoom.</span>
        <span className="shrink-0 tabular-nums">
          {framing.zoom.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×
        </span>
      </p>
    </div>
  )
}
