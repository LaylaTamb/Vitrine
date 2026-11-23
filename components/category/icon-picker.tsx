"use client"

import { EmojiPicker } from "frimousse"
import { ArrowLeft, Pencil, Plus, Search, SmilePlus } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { categoryTintVars, cn } from "@/lib/utils"

// Sete por linha, como a grade.
// prettier-ignore
const EMOJIS = [
  "🍽️", "🍣", "🍕", "🍔", "☕", "🍷", "🍺",
  "🍰", "🎬", "📺", "📚", "🎮", "🎲", "🎵",
  "🎧", "✈️", "🏖️", "🥾", "🏛️", "🎨", "🛍️",
  "👟", "🌱", "🐶", "📍", "🏠", "⭐", "❤️",
]

/** As colunas da lista inteira (cada emoji tem `w-[12.5%]`: mude os dois juntos). */
const COLUMNS = 8

/**
 * O ícone da categoria: um quadrado ao lado do nome. É **um emoji só** (a
 * regra é `isEmojiIcon`, conferida também no servidor). Abre os emojis mais
 * comuns, um toque cada; **Mais emojis** abre a lista inteira, em grupos e com
 * busca em português (`frimousse`, com os nomes do emojibase em `pt`, baixados
 * de um CDN na primeira vez e guardados no navegador). Já pega a cor da
 * categoria.
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
  const [all, setAll] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Escolhido na lista inteira e fora dos comuns: aparece no começo, marcado.
  const quick = value && !EMOJIS.includes(value) ? [value, ...EMOJIS.slice(0, -1)] : EMOJIS

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
        onClick={() => {
          setAll(false)
          setOpen((current) => !current)
        }}
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
          {all ? (
            <AllEmojis onPick={pick} onBack={() => setAll(false)} />
          ) : (
            <>
              <p className="plaque mb-2">Ícone</p>
              <div className="grid grid-cols-7 gap-0.5">
                {quick.map((emoji) => (
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAll(true)}
                >
                  <SmilePlus className="size-4" /> Mais emojis
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>
                  Sem ícone
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** A lista inteira de emojis, em grupos, com a busca (em português) em cima. */
function AllEmojis({ onPick, onBack }: { onPick: (emoji: string) => void; onBack: () => void }) {
  return (
    <EmojiPicker.Root
      locale="pt"
      columns={COLUMNS}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Voltar aos emojis comuns"
          title="Voltar"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
          />
          <EmojiPicker.Search
            autoFocus
            placeholder="Buscar emoji…"
            aria-label="Buscar emoji"
            className="h-8 w-full rounded-lg border border-line bg-bg-soft pr-2 pl-8 text-sm outline-none placeholder:text-faint focus-visible:border-brand-dim [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>
      <EmojiPicker.Viewport className="relative h-64 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Carregando os emojis…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Nenhum emoji com esse nome.
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div className="bg-surface px-1 pt-2 pb-1 text-xs text-faint" {...props}>
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className={cn(
                  // 1/8 da linha (as 8 colunas): uma linha curta, da busca, não estica.
                  "flex aspect-square w-[12.5%] shrink-0 items-center justify-center rounded-lg text-xl leading-none",
                  emoji.isActive && "bg-brand-wash"
                )}
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  )
}
