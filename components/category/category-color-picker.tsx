"use client"

import { Plus, X } from "lucide-react"
import { useEffect, useState } from "react"

import { ColorPalette } from "@/components/tag/color-palette"
import { Input } from "@/components/ui/input"
import { hexToHsv, hsvToHex, parseHexColor, type Hsv } from "@/lib/domain/color"
import { isPaletteColor } from "@/lib/domain/tags"
import { cn } from "@/lib/utils"

const SELECTED_RING = "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-soft)]"

// A volta da roda é o matiz (vermelho no topo, no sentido do relógio); do
// centro para a borda, a saturação.
const HUE_RING = `conic-gradient(${[0, 60, 120, 180, 240, 300, 360]
  .map((hue) => `hsl(${hue} 100% 50%)`)
  .join(", ")})`
const WHEEL_BACKGROUND = `radial-gradient(circle closest-side, #fff, transparent), ${HUE_RING}`

/**
 * A cor da categoria: "sem cor", as 8 da paleta e a nona, "+", que abre a
 * roda de cores com o brilho e o código HEX (digitado ou colado).
 */
export function CategoryColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const custom = value !== null && !isPaletteColor(value)
  const [open, setOpen] = useState(custom)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          title="Sem cor"
          aria-label="Sem cor"
          aria-pressed={value === null}
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint transition-transform",
            value === null ? SELECTED_RING : "hover:scale-110"
          )}
        >
          <X className="size-3.5" />
        </button>
        <ColorPalette
          value={value ?? ""}
          onChange={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
        <button
          type="button"
          title={custom ? `Outra cor: ${value}` : "Outra cor"}
          aria-label={custom ? `Outra cor: ${value}` : "Outra cor"}
          aria-pressed={custom}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-muted-foreground transition-transform",
            custom ? SELECTED_RING : "hover:scale-110 hover:text-foreground"
          )}
          style={custom ? { backgroundColor: value } : undefined}
        >
          {custom ? null : <Plus className="size-3.5" />}
        </button>
      </div>

      {open ? <ColorWheel value={value ?? "#B98CC2"} onChange={onChange} /> : null}
    </div>
  )
}

/** A roda (matiz × saturação), o brilho e o HEX. Qualquer mudança já vale. */
function ColorWheel({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // O matiz mora aqui: no branco ou no preto o HEX não guarda de que cor se partiu.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [text, setText] = useState(value)
  const hex = hsvToHex(hsv)

  // Cor que mudou por fora (a paleta, por exemplo): a roda acompanha.
  useEffect(() => {
    if (parseHexColor(value) !== hsvToHex(hsv)) setHsv(hexToHsv(value))
    setText(value)
    // `hsv` fica de fora de propósito: só reage à cor vinda de fora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function update(next: Hsv) {
    setHsv(next)
    const nextHex = hsvToHex(next)
    setText(nextHex)
    onChange(nextHex)
  }

  function pick(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2
    const dx = event.clientX - rect.left - radius
    const dy = event.clientY - rect.top - radius
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / radius)
    // Escolher na roda com o brilho no zero não mostraria nada: volta a acender.
    update({ h, s, v: hsv.v < 0.15 ? 1 : hsv.v })
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 15 : 5
    const moves: Record<string, Partial<Hsv>> = {
      ArrowRight: { h: (hsv.h + step) % 360 },
      ArrowLeft: { h: (hsv.h - step + 360) % 360 },
      ArrowUp: { s: Math.min(1, hsv.s + step / 100) },
      ArrowDown: { s: Math.max(0, hsv.s - step / 100) },
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    update({ ...hsv, ...move })
  }

  function applyHex(parsed: string) {
    setHsv(hexToHsv(parsed))
    setText(parsed)
    onChange(parsed)
  }

  function typeHex(raw: string) {
    setText(raw)
    // Os 6 dígitos já valem; os 3 ("#abc") só ao sair do campo — no meio da
    // digitação eles ainda podem virar "#abcdef".
    if (/^#?[0-9a-f]{6}$/i.test(raw.trim())) applyHex(parseHexColor(raw)!)
  }

  function leaveHex() {
    const parsed = parseHexColor(text)
    if (parsed && parsed !== hex) applyHex(parsed)
    else setText(hex)
  }

  const angle = (hsv.h * Math.PI) / 180

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-bg-soft p-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Roda de cores"
        aria-roledescription="roda de cores"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={hex}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pick(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) pick(event)
        }}
        onKeyDown={onKeyDown}
        className="relative size-32 shrink-0 cursor-crosshair touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-dim focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-soft)]"
        style={{ background: WHEEL_BACKGROUND }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-black"
          style={{ opacity: 1 - hsv.v }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${50 + Math.sin(angle) * hsv.s * 50}%`,
            top: `${50 - Math.cos(angle) * hsv.s * 50}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <div className="min-w-40 flex-1 space-y-3">
        <label className="block space-y-1.5">
          <span className="plaque block">Brilho</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={(event) => update({ ...hsv, v: Number(event.target.value) / 100 })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-brand"
            style={{ background: `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 1 })})` }}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="plaque block">Código HEX</span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-8 shrink-0 rounded-md border border-line"
              style={{ backgroundColor: hex }}
            />
            <Input
              value={text}
              onChange={(event) => typeHex(event.target.value)}
              onBlur={leaveHex}
              placeholder="#B98CC2"
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={parseHexColor(text) === null}
              className="h-8 font-mono uppercase"
            />
          </span>
        </label>
      </div>
    </div>
  )
}
