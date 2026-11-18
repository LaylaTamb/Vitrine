"use client"

import { BarChart3, ChevronDown } from "lucide-react"

import { VIEW_MODES, type EntryViewMode } from "@/components/layout/view-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GRID_SIZE_OPTIONS, type GridSize } from "@/lib/domain/grid-size"

const NUMBERS = "numeros"

/**
 * "Exibição": num menu só, como mostrar os itens (grade, lista, tier list),
 * a aba Números e o tamanho da grade. O botão diz o que está valendo.
 */
export function DisplayMenu({
  view,
  onViewChange,
  modes,
  numbers,
  onNumbersChange,
  gridSize,
  onGridSizeChange,
}: {
  view: EntryViewMode
  onViewChange: (view: EntryViewMode) => void
  /** Os modos que esta categoria oferece — o tier list só com estrelas. */
  modes: EntryViewMode[]
  /** A aba Números está aberta. */
  numbers: boolean
  onNumbersChange: (numbers: boolean) => void
  gridSize: GridSize
  onGridSizeChange: (size: GridSize) => void
}) {
  const Current = numbers ? BarChart3 : VIEW_MODES[view].Icon
  const label = numbers ? "Números" : VIEW_MODES[view].label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" aria-label={`Exibição: ${label}`}>
          <Current className="size-4" />
          {label}
          <ChevronDown className="size-3.5 text-faint" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Mostrar como</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={numbers ? NUMBERS : view}
          onValueChange={(value) => {
            if (value === NUMBERS) return onNumbersChange(true)
            onNumbersChange(false)
            onViewChange(value as EntryViewMode)
          }}
        >
          {modes.map((mode) => {
            const { Icon, label: modeLabel } = VIEW_MODES[mode]
            return (
              <DropdownMenuRadioItem key={mode} value={mode}>
                <Icon /> {modeLabel}
              </DropdownMenuRadioItem>
            )
          })}
          <DropdownMenuRadioItem value={NUMBERS}>
            <BarChart3 /> Números
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {/* O tamanho vale para a grade e as miniaturas do tier list. */}
        {!numbers && view !== "list" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tamanho</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={gridSize}
              onValueChange={(value) => onGridSizeChange(value as GridSize)}
            >
              {GRID_SIZE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
