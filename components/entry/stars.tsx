"use client"

import { formatRating } from "@/lib/domain/format"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
} as const

export type StarSize = keyof typeof SIZES

/** O espaçamento entre estrelas, compensado por uma margem negativa igual. */
const TRACKING = "0.12em"

/**
 * Exibição: duas fileiras de ★★★★★ sobrepostas — uma apagada embaixo, uma
 * roxa em cima, recortada por `width`. Assim 3,5 estrelas é exatamente 70% da
 * largura. A margem negativa cancela o `letter-spacing` da última estrela,
 * senão o recorte percentual não bateria com a borda real.
 */
export function Stars({
  percent,
  size = "sm",
  className,
}: {
  percent: string | number
  size?: StarSize
  className?: string
}) {
  const width = typeof percent === "number" ? `${percent}%` : percent

  return (
    <span
      aria-hidden
      className={cn("relative inline-block leading-none whitespace-nowrap select-none", className)}
      style={{ fontSize: SIZES[size] }}
    >
      <span
        className="block text-line-hi"
        style={{ letterSpacing: TRACKING, marginRight: `-${TRACKING}` }}
      >
        ★★★★★
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-brand"
        style={{ width }}
      >
        <span
          className="block whitespace-nowrap"
          style={{ letterSpacing: TRACKING, marginRight: `-${TRACKING}` }}
        >
          ★★★★★
        </span>
      </span>
    </span>
  )
}

/**
 * Seleção: a mesma fileira, com 10 áreas clicáveis de 10% por cima — uma por
 * meia estrela.
 */
export function StarInput({
  value,
  onChange,
  size = "lg",
  id,
}: {
  value: number
  onChange: (value: number) => void
  size?: StarSize
  id?: string
}) {
  const steps = Array.from({ length: 10 }, (_, index) => (index + 1) / 2)

  return (
    <span className="relative inline-block" id={id}>
      <Stars percent={`${Math.min(100, Math.max(0, value * 20))}%`} size={size} />
      <span className="absolute inset-0 flex">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            title={`${formatRating(step)} ${step === 0.5 ? "estrela" : "estrelas"}`}
            aria-label={`${formatRating(step)} de 5`}
            onClick={() => onChange(step === value ? 0 : step)}
            className="h-full flex-1 cursor-pointer rounded-[2px] focus-visible:outline-2 focus-visible:outline-brand-dim"
          />
        ))}
      </span>
    </span>
  )
}
