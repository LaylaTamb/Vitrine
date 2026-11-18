"use client"

import { Pencil, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { categoryTintVars, cn } from "@/lib/utils"

// Sete por linha, como a grade.
// prettier-ignore
const EMOJIS = [
  "🍽️", "🍣", "🍕", "🍔", "☕", "🍷", "🍺",
  "🍰", "🎬", "📺", "📚", "🎮", "🎲", "🎵",
  "🎧", "✈️", "🏖️", "🥾", "🏛️", "🎨", "🛍️",
  "👟", "🌱", "🐶", "📍", "🏠", "⭐", "❤️",
]

/**
 * O ícone da categoria: um quadrado ao lado do nome. Abre os emojis mais
 * comuns, um campo para colar outro e "Sem ícone". Já pega a cor da categoria.
 */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string
  color: string | null
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const custom = value && !EMOJIS.includes(value) ? value : ""

  // Fecha ao tocar fora ou com Esc (sem fechar o diálogo de trás).
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    // Na janela, na captura: chega antes do Esc do diálogo, que fecharia tudo.
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={value ? `Ícone: ${value}. Trocar` : "Escolher ícone"}
        style={{
          ...categoryTintVars(color),
          background: "var(--tint-wash, var(--surface))",
          borderColor: color ? "var(--tint-border-hi)" : undefined,
        }}
        className={cn(
          "relative flex size-14 items-center justify-center rounded-2xl border text-[1.75rem] leading-none transition-colors",
          value || color ? "border-solid" : "border-dashed",
          "border-line-hi text-faint hover:border-brand-dim hover:text-foreground"
        )}
      >
        {value ? <span aria-hidden>{value}</span> : <Plus aria-hidden className="size-5" />}
        {value ? (
          <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border-2 border-popover bg-surface-hi text-muted-foreground">
            <Pencil aria-hidden className="size-2.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute top-16 left-0 z-20 w-[min(20rem,calc(100vw-4rem))] rounded-xl border border-line-hi bg-surface p-3 shadow-2xl shadow-black/50">
          <p className="plaque mb-2">Ícone</p>
          <div className="grid grid-cols-7 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                aria-pressed={value === emoji}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-xl leading-none transition-colors hover:bg-brand-wash",
                  value === emoji && "bg-brand-wash"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Input
              value={custom}
              onChange={(event) => onChange(event.target.value.trim())}
              maxLength={4}
              placeholder="Outro: cole aqui"
              aria-label="Outro emoji"
              className="h-8 text-center"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>
              Sem ícone
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
