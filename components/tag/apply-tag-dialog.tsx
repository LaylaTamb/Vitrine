"use client"

import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  applyTagToEntriesAction,
  searchEntriesForTagAction,
  type EntryPickerRow,
} from "@/app/tags/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { plural } from "@/lib/domain/format"
import type { Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * Diálogo "Aplicar a itens": cruza todas as categorias do dono logado. Itens
 * que já têm a tag aparecem marcados e travados — só dá para ADICIONAR por
 * aqui (tirar tag já existe na barra de seleção em massa da categoria).
 */
export function ApplyTagDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: Tag | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<EntryPickerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setRows([])
    setSelected(new Set())
  }, [open, tag?.id])

  useEffect(() => {
    if (!open || !tag) return
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(async () => {
      const result = await searchEntriesForTagAction({ tagId: tag.id, query })
      if (cancelled) return
      setLoading(false)
      if (result.ok && result.data) setRows(result.data)
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, tag, query])

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function apply() {
    if (!tag || selected.size === 0) return
    setPending(true)
    const result = await applyTagToEntriesAction({ tagId: tag.id, ids: [...selected] })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Tag aplicada a ${plural(selected.size, "item", "itens")}.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open && tag !== null} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display text-xl">Aplicar “{tag?.name}” a itens</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cruza todas as suas categorias. Quem já tem a tag aparece marcado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome…"
              className="pl-8"
              autoFocus
            />
          </div>

          <ul className="max-h-80 overflow-y-auto rounded-lg border border-line">
            {loading ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando…</li>
            ) : rows.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum item encontrado.
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id} className="border-b border-line last:border-0">
                  <label
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                      row.hasTag ? "cursor-default opacity-60" : "cursor-pointer hover:bg-surface-hi"
                    )}
                  >
                    <Checkbox
                      checked={row.hasTag || selected.has(row.id)}
                      disabled={row.hasTag}
                      onCheckedChange={() => toggle(row.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span className="shrink-0 text-xs text-faint">
                      {row.categoryIcon ? `${row.categoryIcon} ` : ""}
                      {row.categoryName}
                    </span>
                    {row.hasTag ? (
                      <span className="shrink-0 text-xs text-faint">já tem</span>
                    ) : null}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Fechar
          </Button>
          <Button type="button" onClick={apply} disabled={pending || selected.size === 0}>
            {pending
              ? "Aplicando…"
              : selected.size === 0
                ? "Aplicar"
                : `Aplicar a ${selected.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
