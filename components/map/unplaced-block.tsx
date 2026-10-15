"use client"

import { Pencil, RefreshCw } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { UNPLACED_REASON_LABELS, type UnplacedAddress } from "@/lib/domain/map"
import { cn } from "@/lib/utils"

const PREVIEW = 5

/**
 * "N itens com endereço que não apareceram no mapa": pendentes, não
 * encontrados ou com erro na busca — com
 * "Tentar de novo" (para todos) e "Editar" (para corrigir o endereço).
 */
export function UnplacedBlock({
  items,
  retrying,
  onRetry,
  onEdit,
}: {
  items: UnplacedAddress[]
  retrying: boolean
  onRetry: () => void
  onEdit: (item: UnplacedAddress) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const entries = new Set(items.map((item) => item.entryId)).size
  const visible = expanded ? items : items.slice(0, PREVIEW)

  return (
    <section
      aria-label="Endereços fora do mapa"
      className="space-y-3 rounded-xl border border-dashed border-line bg-bg-soft p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm">
            {entries}{" "}
            {entries === 1
              ? "item com endereço que não apareceu no mapa"
              : "itens com endereço que não apareceram no mapa"}
          </p>
          <p className="text-xs text-faint">
            Pendentes, não encontrados ou com erro na busca. Corrija o endereço ou
            tente de novo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn(retrying && "animate-spin")} />
          {retrying ? "Procurando…" : "Tentar de novo"}
        </Button>
      </div>

      <ul className="divide-y divide-line">
        {visible.map((item) => (
          <li key={item.key} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {item.category.icon ? `${item.category.icon} ` : ""}
                {item.view.name}
                {item.fieldLabel !== "Localização" ? (
                  <span className="text-faint"> · {item.fieldLabel}</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.address}
                <span
                  className={cn(
                    "ml-1.5",
                    item.reason === "not_found" || item.reason === "error"
                      ? "text-danger"
                      : "text-faint"
                  )}
                >
                  · {UNPLACED_REASON_LABELS[item.reason]}
                </span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
              <Pencil /> Editar
            </Button>
          </li>
        ))}
      </ul>

      {items.length > PREVIEW ? (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Mostrar menos" : `Mostrar todos (${items.length})`}
        </Button>
      ) : null}
    </section>
  )
}
