"use client"

import Link from "next/link"
import { ArrowLeft, FolderOpen, RotateCcw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { deleteTrashItemAction, emptyTrashAction, restoreTrashAction } from "@/app/lixeira/actions"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { itemCount } from "@/lib/domain/format"
import { timeAgo } from "@/lib/domain/social"
import {
  purgeLabel,
  restoredHref,
  restoredMessage,
  TRASH_DAYS,
  TRASH_KIND_LABELS,
  type TrashItem,
} from "@/lib/domain/trash"

/**
 * A Lixeira: pastas, categorias e subpastas apagadas, por 30 dias.
 * **Restaurar** devolve para onde estava (ou para a raiz); **Excluir agora**
 * apaga de vez; **Esvaziar** apaga tudo. Só a própria pessoa vê.
 *
 * `now` vem do servidor: "há 3 dias" e "some em 27 dias" saem iguais no HTML
 * e na hidratação.
 */
export function TrashView({
  items,
  now,
  notReady,
}: {
  items: TrashItem[]
  now: string
  /** A migração 37 não rodou: o recado no lugar da lista. */
  notReady: string | null
}) {
  const router = useRouter()
  const [emptying, setEmptying] = useState(false)
  const nowDate = new Date(now)

  async function emptyAll() {
    const result = await emptyTrashAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Lixeira esvaziada.")
    router.refresh()
  }

  return (
    <>
      <PageHeader
        label="Coleções"
        title="Lixeira"
        subtitle={`Pastas, categorias e subpastas apagadas ficam aqui por ${TRASH_DAYS} dias. Depois somem de vez.`}
        actions={
          items.length > 0 ? (
            <Button
              variant="outline"
              size="lg"
              className="text-danger hover:text-danger"
              onClick={() => setEmptying(true)}
            >
              <Trash2 className="size-4" /> Esvaziar lixeira
            </Button>
          ) : null
        }
      />

      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-line-hi hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Coleções
      </Link>

      {notReady ? (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {notReady}
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="A lixeira está vazia"
          description={`Pasta, categoria ou subpasta apagada vem para cá e fica ${TRASH_DAYS} dias, para dar tempo de voltar atrás.`}
        />
      ) : (
        <ul className="space-y-2 pb-16">
          {items.map((item) => (
            <li key={item.id}>
              <TrashRow item={item} now={nowDate} />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={emptying}
        onOpenChange={setEmptying}
        title="Esvaziar a lixeira"
        description={`Tudo o que está na lixeira (${items.length}) vai ser apagado de vez, com o que tem dentro. Não dá para desfazer.`}
        confirmLabel="Esvaziar"
        pendingLabel="Esvaziando…"
        onConfirm={emptyAll}
      />
    </>
  )
}

function TrashRow({ item, now }: { item: TrashItem; now: Date }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const glyph = item.kind === "category" ? item.icon || "📁" : null
  // "há 3 h" e "agora" vão direto; data antiga vira "em 25/09".
  const ago = timeAgo(item.deletedAt, now)
  const when = ago === "agora" || ago.startsWith("há") ? ago : `em ${ago}`

  async function restore() {
    setPending(true)
    const result = await restoreTrashAction({ id: item.id })
    setPending(false)
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Não deu para restaurar agora." : result.error)
      return
    }
    const restored = result.data
    toast.success(restoredMessage(restored), {
      action: { label: "Abrir", onClick: () => router.push(restoredHref(restored)) },
    })
    router.refresh()
  }

  async function deleteNow() {
    const result = await deleteTrashItemAction({ id: item.id })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`“${item.name}” foi excluída de vez.`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-hi text-lg"
        >
          {glyph ?? <FolderOpen className="size-5 text-muted-foreground" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {TRASH_KIND_LABELS[item.kind]}
            {item.itemCount > 0 ? ` · ${itemCount(item.itemCount)}` : ""}
            {item.location ? ` · ${item.location}` : ""}
          </p>
          <p className="text-xs text-faint">
            apagada {when} · {purgeLabel(item.purgeAfter, now)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={restore} disabled={pending}>
          <RotateCcw className="size-3.5" /> {pending ? "Restaurando…" : "Restaurar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => setDeleting(true)}
          disabled={pending}
        >
          Excluir agora
        </Button>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir de vez"
        description={`“${item.name}” vai ser apagada de vez, com tudo o que tem dentro. Não dá para desfazer.`}
        confirmLabel="Excluir de vez"
        pendingLabel="Excluindo…"
        onConfirm={deleteNow}
      />
    </div>
  )
}
