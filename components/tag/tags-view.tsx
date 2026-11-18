"use client"

import { ListPlus, Pencil, Plus, Tags, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useVitrine } from "@/components/providers/vitrine-context"
import { ApplyTagDialog } from "@/components/tag/apply-tag-dialog"
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
import type { Tag } from "@/lib/domain/types"
import type { TagWithUsage } from "@/lib/queries/tags"

type TagCategory = { id: string; name: string; icon: string | null }

/**
 * As tags, que são de cada categoria (migração 49): criar, renomear, trocar a
 * cor, apagar e aplicar a itens. Dentro de uma categoria (\`categoryId\`), só as
 * dela; nas Configurações (\`categories\`), todas, agrupadas por categoria, e a
 * tag nova pergunta em qual categoria nasce.
 */
export function TagsView({
  tags,
  embedded = false,
  categoryId,
  categories,
}: {
  tags: TagWithUsage[]
  /** Dentro das Configurações ou de um diálogo: sem o título grande. */
  embedded?: boolean
  /** Dentro de uma categoria: a tag nova nasce nela, sem perguntar. */
  categoryId?: string
  /** Nas Configurações: as categorias da pessoa, na ordem das Coleções. */
  categories?: TagCategory[]
}) {
  const { actions } = useVitrine()
  const [editing, setEditing] = useState<TagWithUsage | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<TagWithUsage | null>(null)
  const [applying, setApplying] = useState<Tag | null>(null)

  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR)
  const [target, setTarget] = useState<string>(categoryId ?? categories?.[0]?.id ?? "")
  const [pending, setPending] = useState(false)

  const dialogOpen = creating || editing !== null
  const choosesCategory = !categoryId && !editing && (categories?.length ?? 0) > 0

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
      ? await actions.updateTag({ id: editing.id, name, color })
      : await actions.createTag({ name, color, categoryId: categoryId ?? (target || undefined) })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Tag atualizada." : "Tag criada.")
    const wasCreating = !editing
    setEditing(null)
    setCreating(false)
    // Recém-criada: já emenda no diálogo de aplicar a itens.
    if (wasCreating && result.data) setApplying(result.data)
  }

  // Nas Configurações, uma seção por categoria (as tags de antes do 49, sem
  // categoria, ficam juntas no fim).
  const known = new Set((categories ?? []).map((category) => category.id))
  const sections: { key: string; title: string | null; tags: TagWithUsage[] }[] = categories
    ? [
        ...categories.map((category) => ({
          key: category.id,
          title: `${category.icon ? `${category.icon} ` : ""}${category.name}`,
          tags: tags.filter((tag) => tag.categoryId === category.id),
        })),
        {
          key: "sem-categoria",
          title: "Sem categoria",
          tags: tags.filter((tag) => !tag.categoryId || !known.has(tag.categoryId)),
        },
      ].filter((section) => section.tags.length > 0)
    : [{ key: "todas", title: null, tags }]

  return (
    <>
      <PageHeader
        compact={embedded}
        label="Vocabulário"
        title="Tags"
        subtitle={
          categoryId
            ? "As tags desta categoria: só os itens daqui usam."
            : "Cada categoria tem as suas tags. Crie aqui ou dentro da própria categoria, no ⋯."
        }
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
          description={
            categoryId
              ? "Crie a primeira e marque os itens desta categoria."
              : "Cada categoria tem as suas tags: crie a primeira."
          }
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Nova tag
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.key} className="space-y-2">
              {section.title ? (
                <p className="plaque [overflow-wrap:anywhere]">{section.title}</p>
              ) : null}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {section.tags.map((tag) => (
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

                    {/* Sempre à vista: mexer nas tags é o que esta tela faz (no celular não há hover). */}
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setApplying(tag)}
                        title={`Aplicar ${tag.name} a itens`}
                        aria-label={`Aplicar ${tag.name} a itens`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground"
                      >
                        <ListPlus className="size-3.5" />
                      </button>
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
            </section>
          ))}
        </div>
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
                Vale só para os itens da categoria dela.
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

              {choosesCategory ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tag-category" className="plaque">
                    Categoria
                  </Label>
                  <select
                    id="tag-category"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    disabled={pending}
                    className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm outline-none focus-visible:border-brand-dim"
                  >
                    {categories!.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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
          const result = await actions.deleteTag({ id: deleting.id })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Tag excluída.")
          setDeleting(null)
        }}
      />

      <ApplyTagDialog
        tag={applying}
        open={applying !== null}
        onOpenChange={(open) => {
          if (!open) setApplying(null)
        }}
      />
    </>
  )
}
