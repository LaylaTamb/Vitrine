"use client"

import Link from "next/link"
import { Link2, Sparkles, Unlink } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { unlinkCategoryAction } from "@/app/explorar/actions"
import { Notice } from "@/components/layout/notice"
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
 * O aviso de uma cópia do Explorar, numa linha: ligada a @autor (com
 * Desligar) e as novidades que acabaram de chegar — ou o aviso de que a
 * ligação se desfez.
 */
export function LinkedBar({ categoryId, link }: { categoryId: string; link: LinkView }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  if (link.status === "unlinked") {
    return (
      <Notice icon={Unlink} role="status">
        {UNLINKED_NOTICE}
      </Notice>
    )
  }

  return (
    <>
      <Notice
        icon={Link2}
        tone="brand"
        details="Itens novos e edições da original chegam sozinhos, menos nos itens que você editar."
        action={
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Desligar
          </button>
        }
      >
        Ligada a{" "}
        {link.author ? (
          <Link
            href={profilePath(link.author)}
            className="text-foreground underline underline-offset-2"
          >
            @{link.author}
          </Link>
        ) : (
          "a original"
        )}
        : as novidades chegam sozinhas.
      </Notice>
      {link.news ? (
        <Notice icon={Sparkles} role="status">
          {link.news}
        </Notice>
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
    </>
  )
}
