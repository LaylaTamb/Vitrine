"use client"

import { ArrowRight, Check, Clock, HeartHandshake, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { hideMatchAction, openMatchAction, respondMatchAction } from "@/app/matches/actions"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { NewMatchDialog } from "@/components/match/new-match-dialog"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDateBR } from "@/lib/domain/format"
import {
  matchPeopleLabel,
  matchState,
  matchStatusText,
  type MatchMember,
  type MatchState,
  type MatchView,
} from "@/lib/domain/match"
import type { ListProfile } from "@/lib/queries/social"
import { cn } from "@/lib/utils"

const SECTIONS: { state: MatchState; title: string }[] = [
  { state: "answer", title: "Convites para você" },
  { state: "waiting", title: "Esperando respostas" },
  { state: "ready", title: "Prontos" },
  { state: "canceled", title: "Cancelados" },
]

/** Quantos cancelados aparecem (os mais recentes). */
const CANCELED_SHOWN = 5

/** A tela dos matches: convites, os que esperam resposta, os prontos e os cancelados. */
export function MatchesView({
  meId,
  matches,
  friends,
  notReady,
}: {
  meId: string
  matches: MatchView[]
  friends: ListProfile[]
  /** A migração 30 não rodou: o recado no lugar da lista. */
  notReady: string | null
}) {
  const [creating, setCreating] = useState(false)

  const grouped = SECTIONS.map((section) => ({
    ...section,
    items: matches
      .filter((match) => matchState(match, meId) === section.state)
      .slice(0, section.state === "canceled" ? CANCELED_SHOWN : undefined),
  }))

  return (
    <>
      <PageHeader
        label="Comparar coleções"
        title="Matches"
        subtitle="Junte até 8 amigos: cada um ganha a sua cópia, com o que vocês têm em comum e sugestões."
        actions={
          notReady ? null : (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Novo match
            </Button>
          )
        }
      />

      {notReady ? (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {notReady}
        </p>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="Nenhum match ainda"
          description="Chame amigos (quem você segue e segue você de volta) para comparar as coleções."
        />
      ) : (
        <div className="space-y-8 pb-16">
          {grouped
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.state} className="space-y-3">
                <p className="plaque">{section.title}</p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {section.items.map((match) => (
                    <li key={match.id} className="min-w-0">
                      <MatchCard match={match} meId={meId} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      <NewMatchDialog open={creating} onOpenChange={setCreating} friends={friends} />
    </>
  )
}

function MemberChip({ member, isMe }: { member: MatchMember; isMe: boolean }) {
  const Icon = member.status === "accepted" ? Check : member.status === "declined" ? X : Clock
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-foreground">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: member.color }} />
      <span className="truncate">{isMe ? "você" : `@${member.username}`}</span>
      <Icon
        aria-label={
          member.status === "accepted"
            ? "aceitou"
            : member.status === "declined"
              ? "recusou"
              : "ainda não respondeu"
        }
        className={cn(
          "size-3 shrink-0",
          member.status === "accepted" && "text-brand",
          member.status === "declined" && "text-danger"
        )}
      />
    </li>
  )
}

function MatchCard({ match, meId }: { match: MatchView; meId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [hiding, setHiding] = useState(false)
  const state = matchState(match, meId)
  const creator = match.createdBy === meId

  async function respond(accept: boolean) {
    setPending(true)
    const result = await respondMatchAction({ matchId: match.id, accept })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const status = result.data?.status
    if (status === "ready") toast.success("Todo mundo aceitou: o match está pronto!")
    else if (status === "canceled") toast.success("Match cancelado. Todo mundo foi avisado.")
    else toast.success("Aceito. Falta o resto da turma responder.")
    router.refresh()
  }

  async function hide() {
    const result = await hideMatchAction({ matchId: match.id })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Match excluído da sua lista.")
    router.refresh()
  }

  // A cópia é montada na primeira vez que a pessoa abre (pode levar uns segundos).
  async function open() {
    setPending(true)
    const result = await openMatchAction({ matchId: match.id })
    if (!result.ok || !result.data) {
      setPending(false)
      toast.error(result.ok ? "Algo deu errado." : result.error)
      return
    }
    router.push(`/categoria/${result.data.categoryId}`)
  }

  return (
    <div
      className={cn(
        "relative space-y-3 rounded-xl border border-line bg-surface p-4",
        state === "canceled" && "opacity-60"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          (state === "ready" || state === "canceled") && "pr-8"
        )}
      >
        <div className="flex shrink-0 -space-x-2">
          {match.members.slice(0, 4).map((member) => (
            <span
              key={member.userId}
              className="rounded-full"
              style={{ boxShadow: `0 0 0 2px ${member.color}` }}
            >
              <Avatar name={member.displayName || member.username} src={member.avatarUrl} size={32} />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {matchPeopleLabel(match, meId)}
          </p>
          <p className="text-xs text-faint">
            {match.createdAt ? formatDateBR(match.createdAt) : ""}
            {creator ? " · você chamou" : ""}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{matchStatusText(match, meId)}</p>

      <ul className="flex flex-wrap gap-1.5" aria-label="Quem está no match">
        {match.members.map((member) => (
          <MemberChip key={member.userId} member={member} isMe={member.userId === meId} />
        ))}
      </ul>

      {state === "ready" || state === "canceled" ? (
        <button
          type="button"
          onClick={() => setHiding(true)}
          aria-label="Excluir este match da sua lista"
          title="Excluir da sua lista"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}

      {state === "answer" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => respond(true)} disabled={pending}>
            <Check className="size-4" /> Aceitar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={pending}>
            Recusar
          </Button>
        </div>
      ) : state === "ready" ? (
        <Button size="sm" onClick={open} disabled={pending}>
          {pending ? "Abrindo…" : "Abrir a sua cópia"} <ArrowRight className="size-4" />
        </Button>
      ) : state === "waiting" ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          {creator ? "Cancelar o match" : "Desistir"}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={state === "answer" ? "Recusar o match" : creator ? "Cancelar o match" : "Desistir do match"}
        description={
          <p>
            O match é cancelado para todo mundo, e cada um recebe um aviso. Dá para chamar de novo
            depois.
          </p>
        }
        confirmLabel={state === "answer" ? "Recusar" : creator ? "Cancelar o match" : "Desistir"}
        pendingLabel="Cancelando…"
        onConfirm={() => respond(false)}
      />

      <ConfirmDialog
        open={hiding}
        onOpenChange={setHiding}
        title="Excluir da sua lista"
        description={
          <p>
            O match some só da sua lista: para os outros, nada muda. A sua cópia continua em
            Coleções › Matches.
          </p>
        }
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        onConfirm={hide}
      />
    </div>
  )
}
