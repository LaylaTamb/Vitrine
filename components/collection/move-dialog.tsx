"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { moveCategoryAction, moveFolderAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { moveTargets } from "@/lib/domain/collections"
import type { Folder } from "@/lib/domain/types"

const ROOT = "__raiz__"

/**
 * Move uma pasta ou categoria. O `<select>` lista "Raiz das Coleções" e o
 * caminho completo de cada pasta — menos a própria pasta e as descendentes
 * dela, que criariam um ciclo.
 */
export function MoveDialog({
  open,
  onOpenChange,
  folders,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  target: { kind: "folder" | "category"; id: string; name: string; parentId: string | null } | null
}) {
  const [value, setValue] = useState<string>(ROOT)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setValue(target?.parentId ?? ROOT)
  }, [open, target])

  if (!target) return null

  const targets = moveTargets(folders, target.kind === "folder" ? target.id : null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!target) return

    const targetFolderId = value === ROOT ? null : value
    setPending(true)
    const result =
      target.kind === "folder"
        ? await moveFolderAction({ id: target.id, targetFolderId })
        : await moveCategoryAction({ id: target.id, targetFolderId })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Movido.")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="display text-xl">Mover</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Para onde vai <span className="text-foreground">{target.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-4">
            <Label htmlFor="move-target" className="plaque">
              Destino
            </Label>
            <select
              id="move-target"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
            >
              {targets.map((item) => (
                <option key={item.id ?? ROOT} value={item.id ?? ROOT}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Movendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
