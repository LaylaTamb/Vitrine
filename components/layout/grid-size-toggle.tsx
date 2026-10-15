"use client"

import { GRID_SIZE_OPTIONS, type GridSize } from "@/lib/domain/grid-size"
import { cn } from "@/lib/utils"

/** O alternador de tamanho da grade: P / M / G. Mesmo visual do `ViewToggle`. */
export function GridSizeToggle({
  value,
  onChange,
  className,
}: {
  value: GridSize
  onChange: (value: GridSize) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        className
      )}
      role="group"
      aria-label="Tamanho da grade"
    >
      {GRID_SIZE_OPTIONS.map((option) => {
        const label = `Grade ${option.label.toLowerCase()}`
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
              value === option.value
                ? "bg-brand-wash text-brand"
                : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
            )}
          >
            <span aria-hidden>{option.letter}</span>
          </button>
        )
      })}
    </div>
  )
}
