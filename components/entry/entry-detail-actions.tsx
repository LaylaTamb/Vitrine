"use client"

import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EntryForm } from "@/components/entry/entry-form"
import { MoreMenu } from "@/components/layout/more-menu"
import { useVitrine } from "@/components/providers/vitrine-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { CategorySummary, EntryFolder, EntryView, Estrutura, Tag } from "@/lib/domain/types"
import { withFolder } from "@/lib/navigation"

/**
 * O "⋯" da plaqueta (Editar, que também troca de categoria e de pasta, e
 * Excluir) — a ilha de interatividade da página.
 */
export function EntryDetailActions({
  view,
  categoryId,
  estrutura,
  tags,
  folders,
  ratingEnabled,
  categories,
}: {
  view: EntryView
  categoryId: string
  estrutura: Estrutura
  tags: Tag[]
  folders: EntryFolder[]
  ratingEnabled: boolean
  /** As categorias do dono: com elas, a edição pode trocar o item de categoria. */
  categories?: CategorySummary[]
}) {
  const { actions } = useVitrine()
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <MoreMenu label={`Mais opções de “${view.name}”`}>
        <DropdownMenuItem onSelect={() => setFormOpen(true)}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </MoreMenu>

      <EntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categoryId={categoryId}
        estrutura={estrutura}
        tags={tags}
        entry={view}
        folders={folders}
        ratingEnabled={ratingEnabled}
        categories={categories}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir item"
        description={`"${view.name}" some da vitrine. Não dá para desfazer.`}
        onConfirm={async () => {
          const result = await actions.deleteEntry({ id: view.id, categoryId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Item excluído.")
          // Volta para o nível onde o item estava.
          router.push(withFolder(`/categoria/${categoryId}`, view.folderId))
        }}
      />
    </>
  )
}
