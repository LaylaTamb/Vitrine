"use client"

import { Clock } from "lucide-react"
import { Popover } from "radix-ui"
import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  MAX_DURATION_HOURS,
  MAX_DURATION_MINUTES,
  clockParts,
  joinDuration,
  splitMinutes,
} from "@/lib/domain/duration"
import { cn } from "@/lib/utils"

const SEGMENT_CLASS =
  "min-w-0 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"

/**
 * Duração em horas e minutos (00:00). Cada parte se digita separada, as
 * setas (e a roda do mouse, com o campo em foco) sobem e descem, e o relógio
 * abre duas colunas que rolam: horas 0–999, minutos 0–59.
 *
 * `value` e `onChange` falam em MINUTOS TOTAIS, como texto ("" = vazio) — o
 * mesmo que o formulário e o filtro já guardavam.
 */
export function DurationInput({
  id,
  value,
  onChange,
  label,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Nome do campo, para leitores de tela ("Tempo de espera"). */
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState<{ hours: string; minutes: string } | null>(null)
  const shown = draft ?? clockParts(value)
  const hoursRef = useRef<HTMLInputElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const total = value.trim() === "" ? 0 : Number(value)

  function commit(hours: string, minutes: string) {
    onChange(
      hours === "" && minutes === ""
        ? ""
        : String(joinDuration(Number(hours || 0), Number(minutes || 0)))
    )
  }

  function type(part: "hours" | "minutes", raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, part === "hours" ? 3 : 2)
    const next = { ...shown, [part]: digits }
    setDraft(next)
    commit(next.hours, next.minutes)
  }

  function step(part: "hours" | "minutes", direction: 1 | -1, big: boolean) {
    const amount = (part === "hours" ? 60 : 1) * (big ? 10 : 1) * direction
    const next = Math.min(MAX_DURATION_MINUTES, Math.max(0, total + amount))
    setDraft(null)
    onChange(String(next))
  }

  // A roda do mouse só mexe no valor com a parte em foco — senão rolar a
  // página por cima do campo mudaria a duração sem querer. O ouvinte é nativo
  // porque o do React é passivo e não consegue segurar a rolagem.
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const parts: [HTMLInputElement | null, "hours" | "minutes"][] = [
      [hoursRef.current, "hours"],
      [minutesRef.current, "minutes"],
    ]
    const cleanups = parts.map(([input, part]) => {
      if (!input) return () => {}
      const onWheel = (event: WheelEvent) => {
        if (document.activeElement !== input || event.deltaY === 0) return
        event.preventDefault()
        stepRef.current(part, event.deltaY < 0 ? 1 : -1, false)
      }
      input.addEventListener("wheel", onWheel, { passive: false })
      return () => input.removeEventListener("wheel", onWheel)
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  function segmentProps(part: "hours" | "minutes") {
    return {
      inputMode: "numeric" as const,
      autoComplete: "off",
      value: shown[part],
      placeholder: "00",
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => type(part, event.target.value),
      onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
        setDraft(shown)
        event.target.select()
      },
      onBlur: () => setDraft(null),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault()
        step(part, event.key === "ArrowUp" ? 1 : -1, event.shiftKey)
      },
    }
  }

  return (
    <div
      className={cn(
        "flex h-8 w-full min-w-0 items-center rounded-lg border border-input pl-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        className
      )}
    >
      <input
        id={id}
        ref={hoursRef}
        aria-label={`${label}: horas`}
        maxLength={3}
        {...segmentProps("hours")}
        className={cn(SEGMENT_CLASS, "w-[3ch]")}
      />
      <span aria-hidden className="px-0.5 text-muted-foreground">
        :
      </span>
      <input
        ref={minutesRef}
        aria-label={`${label}: minutos`}
        maxLength={2}
        {...segmentProps("minutes")}
        className={cn(SEGMENT_CLASS, "w-[2ch]")}
      />
      <span className="flex-1" />
      <DurationWheel
        label={label}
        total={value.trim() === "" ? null : total}
        onChange={(next) => {
          setDraft(null)
          onChange(next === null ? "" : String(next))
        }}
      />
    </div>
  )
}

/** O relógio e o painel com as duas colunas que rolam. */
function DurationWheel({
  label,
  total,
  onChange,
}: {
  label: string
  total: number | null
  onChange: (total: number | null) => void
}) {
  const { hours, minutes } = splitMinutes(total ?? 0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Dentro de uma janela (o formulário do item), o painel mora nela: a janela
  // trava a rolagem e o toque em tudo o que fica de fora.
  const [container, setContainer] = useState<HTMLElement | null>(null)

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) setContainer(triggerRef.current?.closest<HTMLElement>("[role=dialog]") ?? null)
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Escolher ${label} rolando horas e minutos`}
          title="Escolher rolando"
          className="flex h-full shrink-0 items-center rounded-r-lg px-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <Clock className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-56 space-y-3 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="grid grid-cols-2 gap-2">
            <WheelColumn
              label="Horas"
              unit="h"
              count={MAX_DURATION_HOURS + 1}
              value={hours}
              onChange={(next) => onChange(joinDuration(next, minutes))}
            />
            <WheelColumn
              label="Minutos"
              unit="min"
              count={60}
              value={minutes}
              onChange={(next) => onChange(joinDuration(hours, next))}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Limpar
            </Button>
            <Popover.Close asChild>
              <Button type="button" variant="secondary" size="sm">
                Pronto
              </Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Altura de uma linha da coluna, em px (`h-8`). */
const ROW = 32

/** Uma coluna que rola e encaixa: o número na faixa do meio é o escolhido. */
function WheelColumn({
  label,
  unit,
  count,
  value,
  onChange,
}: {
  label: string
  unit: string
  count: number
  value: number
  onChange: (value: number) => void
}) {
  const optionId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrolling = useRef(false)

  // Abre (e acompanha mudanças de fora) com o valor na faixa do meio.
  useEffect(() => {
    const list = listRef.current
    if (!list || scrolling.current) return
    if (Math.abs(list.scrollTop - value * ROW) > 1) list.scrollTo({ top: value * ROW })
  }, [value])

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current)
    },
    []
  )

  function onScroll() {
    const list = listRef.current
    if (!list) return
    scrolling.current = true
    if (settle.current) clearTimeout(settle.current)
    // Quando a rolagem para (e o encaixe termina), o número do meio vale.
    settle.current = setTimeout(() => {
      scrolling.current = false
      const index = Math.min(count - 1, Math.max(0, Math.round(list.scrollTop / ROW)))
      if (index !== value) onChange(index)
    }, 120)
  }

  function choose(index: number) {
    const next = Math.min(count - 1, Math.max(0, index))
    listRef.current?.scrollTo({ top: next * ROW, behavior: "smooth" })
    if (next !== value) onChange(next)
  }

  return (
    <div className="space-y-1">
      <p className="plaque text-center">{label}</p>
      <div className="relative">
        {/* a faixa do meio: o número que está nela é o escolhido */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-md bg-brand-wash"
        />
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={label}
          aria-activedescendant={`${optionId}-${value}`}
          onScroll={onScroll}
          onKeyDown={(event) => {
            const moves: Record<string, number> = {
              ArrowUp: -1,
              ArrowDown: 1,
              PageUp: -10,
              PageDown: 10,
            }
            if (!(event.key in moves)) return
            event.preventDefault()
            choose(value + moves[event.key])
          }}
          className="relative h-40 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md py-16 outline-none [scrollbar-width:none] focus-visible:ring-1 focus-visible:ring-brand-dim/60 [&::-webkit-scrollbar]:hidden"
        >
          {Array.from({ length: count }, (_, index) => (
            <div
              key={index}
              id={`${optionId}-${index}`}
              role="option"
              aria-selected={index === value}
              onClick={() => choose(index)}
              className={cn(
                "flex h-8 cursor-pointer snap-center items-center justify-center tabular-nums transition-colors",
                index === value ? "text-foreground" : "text-faint hover:text-muted-foreground"
              )}
            >
              {String(index).padStart(2, "0")}
              <span className="ml-1 text-xs text-faint">{unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
