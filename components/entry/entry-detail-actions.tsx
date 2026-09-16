"use client"

import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { deleteEntryAction } from "@/app/categoria/[categoryId]/actions"
import { EntryForm } from "@/components/entry/entry-form"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { EntryView, Estrutura, Tag } from "@/lib/domain/types"

/** Os botões Editar e Excluir da plaqueta — a ilha de interatividade da página. */
export function EntryDetailActions({
  view,
  categoryId,
  estrutura,
  tags,
}: {
  view: EntryView
  categoryId: string
  estrutura: Estrutura
  tags: Tag[]
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="lg" onClick={() => setFormOpen(true)}>
          <Pencil className="size-4" /> Editar
        </Button>
        <Button variant="destructive" size="lg" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> Excluir
        </Button>
      </div>

      <EntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categoryId={categoryId}
        estrutura={estrutura}
        tags={tags}
        entry={view}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir item"
        description={`"${view.name}" some da vitrine. Não dá para desfazer.`}
        onConfirm={async () => {
          const result = await deleteEntryAction({ id: view.id, categoryId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Item excluído.")
          router.push(`/categoria/${categoryId}`)
        }}
      />
    </>
  )
}
