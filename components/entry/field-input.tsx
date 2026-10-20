"use client"

import { DurationInput } from "@/components/entry/duration-input"
import { StarInput } from "@/components/entry/stars"
import { Input } from "@/components/ui/input"
import { DEFAULT_CURRENCY, LOCATION_MAX_LENGTH } from "@/lib/domain/fields"
import { formatRating } from "@/lib/domain/format"
import type { FieldDef } from "@/lib/domain/types"

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
        placeholder="0,00"
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
