"use client"

import { ArrowRightLeft, Tag as TagIcon, TagIcon as TagOff, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  bulkDeleteEntriesAction,
  bulkMoveEntriesAction,
  bulkTagAction,
  movePreviewAction,
} from "@/app/categoria/[categoryId]/actions"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { itemCount, plural } from "@/lib/domain/format"
import type { Category, Tag } from "@/lib/domain/types"

/**
 * A barra flutuante do modo seleção. Toda ação é otimista do ponto de vista da
 * UI (a seleção some na hora) e seguida de `revalidatePath` no servidor.
 */
export function BulkBar({
  categoryId,
  selectedIds,
  onClear,
  siblings,
  tags,
}: {
  categoryId: string
  selectedIds: string[]
  onClear: () => void
  siblings: Pick<Category, "id" | "name" | "icon">[]
  tags: Tag[]
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [tagMode, setTagMode] = useState<"add" | "remove" | null>(null)
  const [pending, setPending] = useState(false)

  const [moveTarget, setMoveTarget] = useState<string>("")
  const [preview, setPreview] = useState<{ dropped: number; kept: number } | null>(null)

  const others = siblings.filter((category) => category.id !== categoryId)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClear()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClear])

  // Trocar de destino recalcula quantos valores se perdem.
  useEffect(() => {
    if (!moveOpen || !moveTarget) {
      setPreview(null)
      return
    }
    let cancelled = false
    void (async () => {
      const result = await movePreviewAction({
        ids: selectedIds,
        categoryId,
        toCategoryId: moveTarget,
      })
      if (!cancelled && result.ok && result.data) setPreview(result.data)
    })()
    return () => {
      cancelled = true
    }
  }, [moveOpen, moveTarget, selectedIds, categoryId])

  async function run(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(true)
    const result = await work()
    setPending(false)
    if (!result.ok) {
      toast.error(result.error ?? "Algo deu errado.")
      return false
    }
    toast.success(success)
    onClear()
    return true
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-hi bg-surface-hi/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <span className="px-1 text-sm">
            <span className="display text-base">{selectedIds.length}</span>{" "}
            <span className="text-muted-foreground">
              {selectedIds.length === 1 ? "item selecionado" : "itens selecionados"}
            </span>
          </span>

          <span className="mx-1 h-5 w-px bg-line" />

          <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} disabled={pending}>
            <ArrowRightLeft className="size-3.5" /> Mover
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTagMode("add")} disabled={pending}>
            <TagIcon className="size-3.5" /> Add tag
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTagMode("remove")} disabled={pending}>
            <TagOff className="size-3.5" /> Tirar tag
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
            className="text-danger hover:text-danger"
          >
            <Trash2 className="size-3.5" /> Excluir
          </Button>

          <span className="mx-1 h-5 w-px bg-line" />

          <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Limpar seleção">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir itens"
        description={`${itemCount(selectedIds.length)} ${selectedIds.length === 1 ? "vai ser apagado" : "vão ser apagados"}. Não dá para desfazer.`}
        onConfirm={async () => {
          await run(
            () => bulkDeleteEntriesAction({ ids: selectedIds, categoryId }),
            "Itens excluídos."
          )
        }}
      />

      {/* mover para outra categoria */}
      <Dialog open={moveOpen} onOpenChange={pending ? undefined : setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-xl">Mover itens</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {itemCount(selectedIds.length)} para outra categoria sua.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-move" className="plaque">
                Categoria de destino
              </Label>
              <select
                id="bulk-move"
                value={moveTarget}
                onChange={(event) => setMoveTarget(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
              >
                <option value="">Escolha…</option>
                {others.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {preview ? (
              <p className="rounded-lg border border-line bg-bg-soft px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {preview.dropped === 0
                  ? "Nenhum valor se perde: todos os campos preenchidos existem no destino."
                  : `${plural(preview.dropped, "valor de campo vai ser descartado", "valores de campo vão ser descartados")} — o destino não tem esses campos. ${
                      preview.kept > 0
                        ? `${plural(preview.kept, "valor é preservado", "valores são preservados")}.`
                        : ""
                    }`}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !moveTarget}
              onClick={async () => {
                const done = await run(
                  () =>
                    bulkMoveEntriesAction({
                      ids: selectedIds,
                      categoryId,
                      toCategoryId: moveTarget,
                    }),
                  "Itens movidos."
                )
                if (done) {
                  setMoveOpen(false)
                  setMoveTarget("")
                }
              }}
            >
              {pending ? "Movendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* adicionar / remover tag */}
      <Dialog
        open={tagMode !== null}
        onOpenChange={(open) => {
          if (!open) setTagMode(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {tagMode === "add" ? "Adicionar tag" : "Remover tag"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Vale para {itemCount(selectedIds.length)} de uma vez.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5 py-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>
            ) : (
              tags.map((tag) => (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  onClick={async () => {
                    if (!tagMode) return
                    const done = await run(
                      () =>
                        bulkTagAction({
                          ids: selectedIds,
                          categoryId,
                          tagId: tag.id,
                          mode: tagMode,
                        }),
                      tagMode === "add" ? "Tag aplicada." : "Tag removida."
                    )
                    if (done) setTagMode(null)
                  }}
                />
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagMode(null)} disabled={pending}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
