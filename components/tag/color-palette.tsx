"use client"

import { TAG_COLORS } from "@/lib/domain/tags"
import { cn } from "@/lib/utils"

/** A paleta de 8 cores das tags; a selecionada ganha um anel branco. */
export function ColorPalette({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.label}
          aria-label={color.label}
          aria-pressed={value.toUpperCase() === color.value.toUpperCase()}
          onClick={() => onChange(color.value)}
          className={cn(
            "size-6 rounded-full transition-transform",
            value.toUpperCase() === color.value.toUpperCase()
              ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-soft)]"
              : "hover:scale-110"
          )}
          style={{ backgroundColor: color.value }}
        />
      ))}
    </div>
  )
}
