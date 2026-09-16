"use client"

import { LayoutGrid, List } from "lucide-react"

import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

/** O alternador Grade / Lista. */
export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: ViewMode
  onChange: (value: ViewMode) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        className
      )}
      role="group"
      aria-label="Modo de exibição"
    >
      {(
        [
          { mode: "grid" as const, Icon: LayoutGrid, label: "Grade" },
          { mode: "list" as const, Icon: List, label: "Lista" },
        ]
      ).map(({ mode, Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          title={label}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            value === mode
              ? "bg-brand-wash text-brand"
              : "text-muted-foreground hover:bg-surface-hi hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
