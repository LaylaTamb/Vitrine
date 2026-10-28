"use client"

import { ArrowLeft, Check, Eye, HeartHandshake, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { bringFromBlendAction } from "@/app/matches/actions"
import { EntryImage } from "@/components/entry/entry-image"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { ShareStoryButton } from "@/components/social/share-story-button"
import { Avatar } from "@/components/ui/avatar-image"
import {
  BLEND_KIND_LABEL,
  TASTE_WEIGHTS,
  tasteWhy,
  type BlendHighlights,
  type BlendPick,
  type BlendTaste,
  type PairTaste,
} from "@/lib/domain/blend"
import { formatRating, plural } from "@/lib/domain/format"
import { matchPeopleLabel, matchStatusText, type MatchView } from "@/lib/domain/match"
import { imageTransformOf } from "@/lib/domain/view"
import { cn } from "@/lib/utils"

const CHIP = "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors whitespace-nowrap"
const CHIP_ON = "border-brand-dim bg-brand-wash text-foreground"
const CHIP_OFF = "border-line text-muted-foreground hover:border-line-hi hover:text-foreground"

/**
 * A tela de um match: a % num anel, o "Por quê?", o que une vocês e a lista
 * do dia — numerada, com de quem veio cada item e a nota de cada um, e o ＋
 * para trazer o que é dos outros para a sua A organizar.
 */
export function BlendView({
  meId,
  match,
  picks,
  taste,
  highlights,
  brought,
  notReady,
}: {
  meId: string
  match: MatchView
  picks: BlendPick[]
  taste: BlendTaste | null
  highlights: BlendHighlights | null
  /** Os itens originais que você já trouxe. */
  brought: string[]
  /** A migração 45 não rodou: o recado no lugar da lista. */
  notReady: string | null
}) {
  const [family, setFamily] = useState<string | null>(null)
  const members = useMemo(
    () => new Map(match.members.map((member) => [member.userId, member])),
    [match.members]
  )
  const labelOf = (userId: string) =>
    userId === meId ? "você" : `@${members.get(userId)?.username ?? "alguém"}`
  const broughtSet = useMemo(() => new Set(brought), [brought])

  // Os filtros: uma pílula por família, com o nome mais curto e na ordem da lista.
  const families = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null; count: number }>()
    for (const pick of picks) {
      const current = map.get(pick.item.family)
      const name =
        current && current.name.length <= pick.item.categoryName.length
          ? current.name
          : pick.item.categoryName
      map.set(pick.item.family, {
        name,
        icon: current?.icon ?? pick.item.categoryIcon,
        count: (current?.count ?? 0) + 1,
      })
    }
    return [...map.entries()]
  }, [picks])

  const back = (
    <Link
      href="/matches"
      className="inline-flex items-center gap-1.5 pt-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Match
    </Link>
  )
  const header = (
    <PageHeader
      label="Match"
      title={matchPeopleLabel(match, meId)}
      subtitle="A lista de hoje, a mesma para todo mundo do match. Muda um pouco a cada dia."
      className="pt-3"
      actions={
        match.status === "ready" && !notReady && picks.length > 0 ? (
          <ShareStoryButton
            src={`/matches/${match.id}/story`}
            fileName="vitrine-match.png"
            title="O nosso match no Vitrine"
            size="lg"
          />
        ) : null
      }
    />
  )

  if (notReady || match.status !== "ready") {
    return (
      <>
        {back}
        {header}
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          {notReady ?? matchStatusText(match, meId)}
        </p>
      </>
    )
  }

  const duo = taste?.pairs.length === 1 ? taste.pairs[0] : null
  const shown = picks
    .map((pick, index) => ({ pick, position: index + 1 }))
    .filter(({ pick }) => family === null || pick.item.family === family)

  return (
    <div className="pb-16">
      {back}
      {header}

      <section
        aria-label="A compatibilidade"
        className="mb-5 flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-center sm:flex-row sm:items-start sm:p-5 sm:text-left"
      >
        <Ring percent={taste?.percent ?? null} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex justify-center -space-x-2 sm:justify-start">
            {match.members.map((member) => (
              <span
                key={member.userId}
                className="rounded-full"
                style={{ boxShadow: `0 0 0 2px ${member.color}` }}
                title={labelOf(member.userId)}
              >
                <Avatar
                  name={member.displayName || member.username}
                  src={member.avatarUrl}
                  size={32}
                />
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {duo
              ? tasteWhy(duo)
              : taste?.best
                ? `A média dos ${taste.pairs.length} pares. Os mais parecidos: ${labelOf(taste.best.a)} e ${labelOf(taste.best.b)}, com ${taste.best.percent}%.`
                : "Ainda não dá para comparar."}
          </p>
          {taste && taste.pairs.length > 0 ? (
            <details className="group rounded-xl border border-line text-left">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-foreground [&::-webkit-details-marker]:hidden">
                Por quê?
              </summary>
              <div className="space-y-4 border-t border-line px-3 py-3">
                {taste.pairs.map((pair) => (
                  <PairWhy
                    key={`${pair.a}-${pair.b}`}
                    pair={pair}
                    title={duo ? null : `${labelOf(pair.a)} e ${labelOf(pair.b)}`}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </section>

      {highlights && (highlights.family || highlights.item) ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {highlights.family ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="plaque">A categoria que une vocês</p>
              <p className="display mt-2 text-2xl leading-tight [overflow-wrap:anywhere]">
                {highlights.family.icon ? `${highlights.family.icon} ` : ""}
                {highlights.family.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plural(highlights.family.common, "coisa em comum", "coisas em comum")}
              </p>
            </div>
          ) : null}
          {highlights.item ? (
            <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="w-14 shrink-0">
                <EntryImage
                  imageUrl={highlights.item.item.imageUrl}
                  imageTransform={imageTransformOf(highlights.item.item.imageDisplay)}
                  initial={highlights.item.item.name.charAt(0).toUpperCase()}
                  ratio="4 / 5"
                  initialSize="1.5rem"
                />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="plaque">O item que une vocês</p>
                <p className="font-medium leading-snug [overflow-wrap:anywhere]">
                  {highlights.item.item.name}
                </p>
                <OwnerRatings
                  owners={highlights.item.owners}
                  labelOf={labelOf}
                  colorOf={(userId) => members.get(userId)?.color}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {picks.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="A lista ainda está vazia"
          description="Vocês ainda não têm nada em comum que todos possam ver. Quando catalogarem categorias parecidas, a lista aparece aqui."
        />
      ) : (
        <>
          <div
            role="group"
            aria-label="Filtrar por categoria"
            className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0"
          >
            <button
              type="button"
              aria-pressed={family === null}
              onClick={() => setFamily(null)}
              className={cn(CHIP, family === null ? CHIP_ON : CHIP_OFF)}
            >
              Tudo <span className="ml-1 text-faint">{picks.length}</span>
            </button>
            {families.map(([key, option]) => (
              <button
                key={key}
                type="button"
                aria-pressed={family === key}
                onClick={() => setFamily(family === key ? null : key)}
                className={cn(CHIP, family === key ? CHIP_ON : CHIP_OFF)}
              >
                {option.icon ? `${option.icon} ` : ""}
                {option.name}
                <span className="ml-1 text-faint">{option.count}</span>
              </button>
            ))}
          </div>

          <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {shown.map(({ pick, position }) => {
              const mine = pick.owners.some((owner) => owner.userId === meId)
              return (
                <li key={pick.key} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums text-faint">
                    {position}
                  </span>
                  <Link
                    href={`/categoria/${pick.item.categoryId}/${pick.item.entryId}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="w-12 shrink-0 sm:w-14">
                      <EntryImage
                        imageUrl={pick.item.imageUrl}
                        imageTransform={imageTransformOf(pick.item.imageDisplay)}
                        initial={pick.item.name.charAt(0).toUpperCase()}
                        ratio="4 / 5"
                        initialSize="1.25rem"
                      />
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                        {pick.item.name}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {pick.item.categoryIcon ? `${pick.item.categoryIcon} ` : ""}
                        {pick.item.categoryName} ·{" "}
                        <span
                          className={
                            pick.kind === "common" ? "text-brand" : "text-muted-foreground"
                          }
                        >
                          {BLEND_KIND_LABEL[pick.kind]}
                        </span>
                      </span>
                      <OwnerRatings
                        owners={pick.owners}
                        labelOf={labelOf}
                        colorOf={(userId) => members.get(userId)?.color}
                      />
                    </span>
                  </Link>
                  {mine ? null : (
                    <BringBlendButton
                      matchId={match.id}
                      entryId={pick.item.entryId}
                      name={pick.item.name}
                      done={pick.owners.some((owner) => broughtSet.has(owner.entryId))}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
        <Eye aria-hidden className="mt-0.5 size-3 shrink-0" />
        <span>
          Entra só o que todas as pessoas do match podem ver, e nunca o que é privado. O ＋ leva um
          item para a sua A organizar, sem a nota de quem colocou.
        </span>
      </p>
    </div>
  )
}

/** O anel: a parte colorida é a %. */
function Ring({ percent }: { percent: number | null }) {
  return (
    <div
      className="flex size-28 shrink-0 items-center justify-center rounded-full"
      style={{
        background:
          percent === null
            ? "var(--color-line)"
            : `conic-gradient(var(--color-brand) ${percent}%, var(--color-line) 0)`,
      }}
    >
      <div className="flex size-[94px] flex-col items-center justify-center rounded-full bg-surface">
        <span className="display text-3xl leading-none">
          {percent === null ? "—" : `${percent}%`}
        </span>
        <span className="mt-0.5 text-[0.65rem] text-muted-foreground">compatíveis</span>
      </div>
    </div>
  )
}

/** As três partes da % de um par, cada uma com o peso dela. */
function PairWhy({ pair, title }: { pair: PairTaste; title: string | null }) {
  const parts: { label: string; weight: number; value: number | null; note?: string }[] = [
    { label: "Categorias em comum", weight: TASTE_WEIGHTS.worlds, value: pair.worlds },
    { label: "Itens iguais", weight: TASTE_WEIGHTS.items, value: pair.items },
    {
      label: "Notas parecidas",
      weight: TASTE_WEIGHTS.ratings,
      value: pair.agreement,
      note: "poucas notas dos dois: o peso foi para os itens",
    },
  ]
  return (
    <div className="space-y-2.5">
      {title ? (
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="min-w-0 truncate">{title}</span>
          <span className="display shrink-0 text-brand">{pair.percent}%</span>
        </p>
      ) : null}
      {title ? <p className="text-xs text-muted-foreground">{tasteWhy(pair)}</p> : null}
      {parts.map((part) => (
        <div key={part.label} className="space-y-1">
          <p className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {part.label}{" "}
              <span className="text-faint">(vale {Math.round(part.weight * 100)}%)</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {part.value === null ? "—" : `${part.value}%`}
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${part.value ?? 0}%` }}
            />
          </div>
          {part.value === null && part.note ? (
            <p className="text-[0.7rem] text-faint">{part.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** "● você ★ 5 · ● @ana ★ 4,5" — a cor de cada pessoa no match. */
function OwnerRatings({
  owners,
  labelOf,
  colorOf,
}: {
  owners: { userId: string; rating: number | null }[]
  labelOf: (userId: string) => string
  colorOf: (userId: string) => string | undefined
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
      {owners.map((owner) => (
        <span key={owner.userId} className="inline-flex min-w-0 items-center gap-1">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorOf(owner.userId) }}
          />
          <span className="truncate">{labelOf(owner.userId)}</span>
          {owner.rating === null ? (
            <span className="text-faint">sem nota</span>
          ) : (
            <span className="whitespace-nowrap">
              <span aria-hidden className="text-brand">
                ★
              </span>
              <span className="sr-only">nota</span> {formatRating(owner.rating)}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

/** O ＋ da lista: um toque leva o item para a A organizar (de novo, só avisa que já está lá). */
function BringBlendButton({
  matchId,
  entryId,
  name,
  done,
}: {
  matchId: string
  entryId: string
  name: string
  done: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "pending" | "done">(done ? "done" : "idle")

  async function bring() {
    if (state !== "idle") return
    setState("pending")
    const result = await bringFromBlendAction({ matchId, entryId })
    if (!result.ok) {
      setState("idle")
      toast.error(result.error)
      return
    }
    setState("done")
    const target = result.data
    toast.success(
      target?.already
        ? `“${name}” já estava na sua A organizar.`
        : `“${name}” foi para a sua A organizar.`,
      target
        ? {
            action: { label: "Ver", onClick: () => router.push(`/categoria/${target.categoryId}`) },
          }
        : undefined
    )
  }

  const Icon = state === "done" ? Check : Plus
  return (
    <button
      type="button"
      onClick={bring}
      disabled={state !== "idle"}
      title={
        state === "done" ? "Já está na sua A organizar" : `Trazer “${name}” para a sua A organizar`
      }
      aria-label={
        state === "done"
          ? `${name} já está na sua A organizar`
          : `Trazer ${name} para a sua A organizar`
      }
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-80",
        state === "done"
          ? "border-brand-dim text-brand"
          : "border-line text-foreground hover:border-brand-dim hover:text-brand"
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
