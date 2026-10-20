"use client"

import { Tag as TagIcon, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { BringButton } from "@/components/match/match-marks"
import { useVitrine } from "@/components/providers/vitrine-context"
import { TagPill } from "@/components/tag/tag-pill"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EntryView, Tag } from "@/lib/domain/types"
import { withFolder } from "@/lib/navigation"

/**
 * Os botões de um item da cópia de um match: Trazer (o que é de outra
 * pessoa), Tags (as suas, nesta cópia) e Excluir (só da cópia). Nome, nota e
 * campos não se editam: são do original.
 */
export function MatchEntryActions({
  view,
  categoryId,
  tags,
  isMine,
}: {
  view: EntryView
  categoryId: string
  tags: Tag[]
  isMine: boolean
}) {
  const { actions } = useVitrine()
  const router = useRouter()
  const [tagsOpen, setTagsOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pendingTag, setPendingTag] = useState<string | null>(null)
  // Otimista: a pílula troca na hora; volta se o servidor recusar.
  const [tagIds, setTagIds] = useState<string[]>(view.tags.map((tag) => tag.id))

  async function toggleTag(tag: Tag) {
    if (pendingTag) return
    const has = tagIds.includes(tag.id)
    setPendingTag(tag.id)
    setTagIds((current) => (has ? current.filter((id) => id !== tag.id) : [...current, tag.id]))
    const result = await actions.bulkTag({
      ids: [view.id],
      categoryId,
      tagId: tag.id,
      mode: has ? "remove" : "add",
    })
    setPendingTag(null)
    if (!result.ok) {
      setTagIds((current) => (has ? [...current, tag.id] : current.filter((id) => id !== tag.id)))
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-2">
        {isMine ? null : <BringButton entryId={view.id} name={view.name} variant="detail" />}
        <Button variant="outline" size="lg" onClick={() => setTagsOpen(true)}>
          <TagIcon className="size-4" /> Tags
        </Button>
        <Button variant="destructive" size="lg" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> Excluir da cópia
        </Button>
      </div>

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-xl">Tags</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              As suas tags neste item da cópia. Toque para pôr ou tirar.
            </DialogDescription>
          </DialogHeader>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tag ainda: crie na tela Tags, no menu principal.
            </p>
          ) : (
            <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto py-1">
              {tags.map((tag) => (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  active={tagIds.includes(tag.id)}
                  onClick={() => toggleTag(tag)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir da cópia"
        description={`"${view.name}" sai da sua cópia do match. O original continua com quem é dono.`}
        onConfirm={async () => {
          const result = await actions.deleteEntry({ id: view.id, categoryId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Item excluído da cópia.")
          router.push(withFolder(`/categoria/${categoryId}`, view.folderId))
        }}
      />
    </>
  )
}
