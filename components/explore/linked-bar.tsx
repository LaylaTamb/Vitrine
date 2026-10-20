"use client"

import Link from "next/link"
import { Link2, Unlink } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { unlinkCategoryAction } from "@/app/explorar/actions"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { UNLINKED_NOTICE } from "@/lib/domain/explore"
import { profilePath } from "@/lib/domain/username"

/** O estado da ligação que a página manda (depois de sincronizar). */
export interface LinkView {
  /** "linked" = ainda ligada; "unlinked" = o banco acabou de desfazer. */
  status: "linked" | "unlinked"
  author: string | null
  /** O que chegou agora ("Novidades de @ana: 2 itens novos…") ou `null`. */
  news: string | null
}

/**
 * A faixa de uma cópia do Explorar: ligada a @autor (com Desligar) e as
 * novidades que acabaram de chegar — ou o aviso de que a ligação se desfez.
 */
export function LinkedBar({ categoryId, link }: { categoryId: string; link: LinkView }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  if (link.status === "unlinked") {
    return (
      <p
        role="status"
        className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground"
      >
        <Unlink aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
        <span>{UNLINKED_NOTICE}</span>
      </p>
    )
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-brand-dim bg-brand-wash px-3 py-2 text-sm">
        <Link2 aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="min-w-[12rem] flex-1 text-foreground">
          Ligada a{" "}
          {link.author ? (
            <Link href={profilePath(link.author)} className="underline underline-offset-2">
              @{link.author}
            </Link>
          ) : (
            "a original"
          )}
          : itens novos e edições chegam sozinhos (menos nos itens que você editar).
        </span>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Desligar
        </Button>
      </div>
      {link.news ? (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          {link.news}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Desligar da original"
        description={
          <p>
            A sua cópia fica como está e para de receber as novidades
            {link.author ? ` de @${link.author}` : ""}. Para ligar de novo, só pegando outra vez
            no Explorar.
          </p>
        }
        confirmLabel="Desligar"
        pendingLabel="Desligando…"
        onConfirm={async () => {
          const result = await unlinkCategoryAction({ categoryId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Desligada. A categoria agora é só sua.")
          router.refresh()
        }}
      />
    </div>
  )
}
