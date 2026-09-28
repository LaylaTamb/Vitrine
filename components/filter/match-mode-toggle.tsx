"use client"

import { MATCH_MODE_OPTIONS, type MatchMode } from "@/lib/domain/filter"
import { cn } from "@/lib/utils"

/**
 * O switch E | OU. Diz como as regras marcadas se combinam: E exige todas,
 * OU se contenta com uma.
 */
export function MatchModeToggle({
  value,
  onChange,
  label = "Combinar",
  className,
}: {
  value: MatchMode
  onChange: (mode: MatchMode) => void
  label?: string
  className?: string
}) {
  const current = MATCH_MODE_OPTIONS.find((option) => option.value === value)

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className="plaque shrink-0">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex shrink-0 rounded-md border border-line bg-bg-soft p-0.5"
      >
        {MATCH_MODE_OPTIONS.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={`${option.label}: ${option.hint}`}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-w-8 rounded px-2 py-0.5 font-medium transition-colors",
                active
                  ? "bg-brand-wash text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {current ? <span className="truncate text-faint">{current.hint}</span> : null}
    </div>
  )
}
