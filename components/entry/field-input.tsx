"use client"

import { DurationInput } from "@/components/entry/duration-input"
import { StarInput } from "@/components/entry/stars"
import { Input } from "@/components/ui/input"
import { DEFAULT_CURRENCY, LOCATION_MAX_LENGTH } from "@/lib/domain/fields"
import { formatRating } from "@/lib/domain/format"
import type { FieldDef } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** Até quantas opções uma lista vira botões (mais que isso, o seletor). */
const CHOICE_BUTTONS_MAX = 6

/**
 * O controle de UM campo da estrutura, pelo tipo dele. O valor é sempre o
 * texto que vai para `custom_fields` (o servidor converte). Usado no
 * formulário do item e no acesso rápido (que pede só o campo principal).
 * O rótulo fica com quem usa: `id` é `field-<id do campo>`.
 */
export function FieldInput({
  field,
  value,
  onChange,
  autoFocus,
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  const id = `field-${field.id}`

  if (field.tipo === "star") {
    return (
      <div className="flex items-center gap-2">
        <StarInput
          size="md"
          value={Number(value || 0)}
          onChange={(next) => onChange(next ? String(next) : "")}
        />
        <span className="text-xs text-muted-foreground">
          {value ? formatRating(Number(value)) : "—"}
        </span>
      </div>
    )
  }

  // Lista curta: botões, um toque escolhe e outro toque desmarca.
  const options = field.opcoes ?? []
  if (field.tipo === "select" && options.length > 0 && options.length <= CHOICE_BUTTONS_MAX) {
    // Um valor que saiu da lista continua gravado: aparece marcado, para não sumir calado.
    const shown = value && !options.includes(value) ? [...options, value] : options
    return (
      <div id={id} role="radiogroup" aria-label={field.nome} className="flex flex-wrap gap-1.5">
        {shown.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            autoFocus={autoFocus && index === 0}
            onClick={() => onChange(value === option ? "" : option)}
            className={cn(
              "inline-flex max-w-full items-center rounded-lg border px-3 py-1.5 text-sm transition-colors [overflow-wrap:anywhere]",
              value === option
                ? "border-brand-dim bg-brand-wash text-foreground"
                : "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  if (field.tipo === "select") {
    return (
      <select
        id={id}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
      >
        <option value="">—</option>
        {(field.opcoes ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.tipo === "currency") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex h-9 shrink-0 items-center rounded-md border border-line bg-bg-soft px-2 text-sm text-muted-foreground">
          {field.moeda ?? DEFAULT_CURRENCY}
        </span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    )
  }

  if (field.tipo === "location") {
    return (
      <Input
        id={id}
        placeholder="Rua, número, bairro ou nome do lugar"
        maxLength={LOCATION_MAX_LENGTH}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.tipo === "time") {
    return <DurationInput id={id} label={field.nome} value={value} onChange={onChange} />
  }

  if (field.tipo === "decimal") {
    return (
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <Input
      id={id}
      type={field.tipo === "int" ? "number" : field.tipo === "date" ? "date" : "text"}
      step={field.tipo === "int" ? 1 : undefined}
      inputMode={field.tipo === "int" ? "numeric" : undefined}
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
