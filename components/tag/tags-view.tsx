"use client"

import { Pencil, Plus, Tags, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { createTagAction, deleteTagAction, updateTagAction } from "@/app/tags/actions"
import { ColorPalette } from "@/components/tag/color-palette"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { itemCount } from "@/lib/domain/format"
import { DEFAULT_TAG_COLOR } from "@/lib/domain/tags"
import type { TagWithUsage } from "@/lib/queries/tags"

export function TagsView({ tags }: { tags: TagWithUsage[] }) {
  const [editing, setEditing] = useState<TagWithUsage | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<TagWithUsage | null>(null)

  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR)
  const [pending, setPending] = useState(false)

  const dialogOpen = creating || editing !== null

  useEffect(() => {
    if (!dialogOpen) return
    setName(editing?.name ?? "")
    setColor(editing?.color ?? DEFAULT_TAG_COLOR)
  }, [dialogOpen, editing])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setPending(true)
    const result = editing
      ? await updateTagAction({ id: editing.id, name, color })
      : await createTagAction({ name, color })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Tag atualizada." : "Tag criada.")
    setEditing(null)
    setCreating(false)
  }

  return (
    <>
      <PageHeader
        label="Vocabulário"
        title="Tags"
        subtitle="As tags são do grupo inteiro: qualquer pessoa cria, edita e apaga, e a mudança vale para o acervo de todo mundo."
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nova tag
          </Button>
        }
      />

      {tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma tag ainda"
          description="Tags atravessam todas as categorias: crie a primeira e comece a cruzar o acervo."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Nova tag
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="group/card vitrine-card flex items-center gap-3 px-3 py-2.5"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="display block truncate text-base">{tag.name}</span>
                <span className="text-xs text-muted-foreground">
                  {tag.usage === 0 ? "nenhum item" : itemCount(tag.usage)}
                </span>
              </span>

              <span className="card-actions flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setEditing(tag)}
                  title={`Editar ${tag.name}`}
                  aria-label={`Editar ${tag.name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(tag)}
                  title={`Excluir ${tag.name}`}
                  aria-label={`Excluir ${tag.name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (pending) return
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="display text-xl">
                {editing ? "Editar tag" : "Nova tag"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Vale para o acervo de todo mundo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="tag-name" className="plaque">
                  Nome
                </Label>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  autoFocus
                  placeholder="Japonês"
                />
              </div>

              <div className="space-y-1.5">
                <span className="plaque block">Cor</span>
                <ColorPalette value={color} onChange={setColor} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false)
                  setEditing(null)
                }}
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Excluir tag"
        description={
          deleting && deleting.usage > 0
            ? `Essa tag está em ${itemCount(deleting.usage)}. Remover mesmo assim? Os itens continuam existindo — só perdem essa tag.`
            : "Essa tag não está em nenhum item."
        }
        onConfirm={async () => {
          if (!deleting) return
          const result = await deleteTagAction({ id: deleting.id })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Tag excluída.")
          setDeleting(null)
        }}
      />
    </>
  )
}
