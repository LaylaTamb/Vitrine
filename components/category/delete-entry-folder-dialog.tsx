"use client"

import { useState } from "react"
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
import type { EntryFolderTotals } from "@/lib/domain/entry-folders"
import { itemCount, plural } from "@/lib/domain/format"

/**
 * Excluir uma subpasta de categoria. Pasta vazia: confirmação simples. Pasta
 * com conteúdo: a pessoa escolhe entre levar tudo junto ou manter os itens —
 * eles (e as subpastas) sobem um nível.
 */
export function DeleteEntryFolderDialog({
  folder,
  totals,
  parentLabel,
  onOpenChange,
}: {
  folder: { id: string; name: string } | null
  totals: EntryFolderTotals | undefined
  /** Para onde o conteúdo sobe: "Marcas" ou "a raiz da categoria". */
  parentLabel: string
  onOpenChange: (open: boolean) => void
}) {
  const { actions } = useVitrine()
  const [pending, setPending] = useState<"keep" | "all" | null>(null)

  const empty = !totals || (totals.entries === 0 && totals.folders === 0)

  async function run(keepContents: boolean) {
    if (!folder) return
    setPending(keepContents ? "keep" : "all")
    const result = await actions.deleteEntryFolder({ id: folder.id, keepContents })
    setPending(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(keepContents ? "Pasta excluída. O conteúdo subiu um nível." : "Pasta excluída.")
    onOpenChange(false)
  }

  const parts: string[] = []
  if (totals?.folders) parts.push(plural(totals.folders, "subpasta", "subpastas"))
  if (totals?.entries) parts.push(itemCount(totals.entries))

  return (
    <Dialog open={folder !== null} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-xl">Excluir pasta</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {empty ? (
                <p>
                  “{folder?.name}” está vazia. Excluir?
                </p>
              ) : (
                <>
                  <p>
                    “{folder?.name}” tem {parts.join(" e ")} no total.
                  </p>
                  <p>
                    <span className="text-foreground">Manter conteúdo</span>: só a pasta some, e o
                    que estava nela vai para {parentLabel}.{" "}
                    <span className="text-foreground">Excluir tudo</span>: apaga a pasta com tudo
                    dentro — não dá para desfazer.
                  </p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={pending !== null}
          >
            Cancelar
          </Button>
          {empty ? null : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => run(true)}
              disabled={pending !== null}
            >
              {pending === "keep" ? "Excluindo…" : "Manter conteúdo"}
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => run(false)}
            disabled={pending !== null}
          >
            {pending === "all" ? "Excluindo…" : empty ? "Excluir" : "Excluir tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
