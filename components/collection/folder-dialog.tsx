"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Onde a pasta mora: nas Coleções (organiza categorias) ou dentro de uma
 * categoria (organiza os itens dela).
 */
export type FolderScope =
  | { kind: "collection"; parentFolderId: string | null }
  | { kind: "category"; categoryId: string; parentFolderId: string | null }

/** Cria ou renomeia uma pasta. */
export function FolderDialog({
  open,
  onOpenChange,
  folder,
  scope,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem folder = criar. */
  folder?: { id: string; name: string } | null
  scope: FolderScope
}) {
  const { actions } = useVitrine()
  const [name, setName] = useState(folder?.name ?? "")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) setName(folder?.name ?? "")
  }, [open, folder])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setPending(true)
    const result =
      scope.kind === "collection"
        ? folder
          ? await actions.renameFolder({ id: folder.id, name })
          : await actions.createFolder({ name, parentFolderId: scope.parentFolderId })
        : folder
          ? await actions.renameEntryFolder({ id: folder.id, name })
          : await actions.createEntryFolder({
              categoryId: scope.categoryId,
              name,
              parentFolderId: scope.parentFolderId,
            })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(folder ? "Pasta renomeada." : "Pasta criada.")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {folder ? "Renomear pasta" : "Nova pasta"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {scope.kind === "collection"
                ? "Pastas organizam suas categorias e podem ser aninhadas."
                : "Pastas separam os itens desta categoria (ex.: Feitos em casa, Marca 1) e podem ser aninhadas."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-4">
            <Label htmlFor="folder-name" className="plaque">
              Nome
            </Label>
            <Input
              id="folder-name"
              value={name}
              autoFocus
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder={scope.kind === "collection" ? "Comida" : "Feitos em casa"}
            />
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
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
