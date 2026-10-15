"use client"

import { LayoutGrid, List, Rows3, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

/** Só a tela de uma categoria tem o tier list — Coleções seguem com `ViewMode`. */
export type EntryViewMode = ViewMode | "tier"

const MODES: Record<EntryViewMode, { Icon: LucideIcon; label: string }> = {
  grid: { Icon: LayoutGrid, label: "Grade" },
  list: { Icon: List, label: "Lista" },
  tier: { Icon: Rows3, label: "Tier list" },
}

const GRID_AND_LIST: ViewMode[] = ["grid", "list"]

/** O alternador de modo de exibição. Por padrão, Grade / Lista. */
export function ViewToggle<T extends EntryViewMode = ViewMode>({
  value,
  onChange,
  modes = GRID_AND_LIST as T[],
  className,
}: {
  value: T
  onChange: (value: T) => void
  /** Quais modos aparecem, na ordem. */
  modes?: T[]
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
      {modes.map((mode) => {
        const { Icon, label } = MODES[mode]
        return (
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
        )
      })}
    </div>
  )
}
