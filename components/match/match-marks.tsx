"use client"

import { ArrowDownToLine, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { bringFromMatchAction } from "@/app/matches/actions"
import { Button } from "@/components/ui/button"
import { matchOwnerText } from "@/lib/domain/match"
import type { EntryMatch } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** A linha do card na cópia de um match: de quem é, "Em comum" e "Sugestão". */
export function MatchOwnerLine({
  match,
  compact = false,
  className,
}: {
  match: EntryMatch
  /** Grade pequena: só a bolinha e o dono. */
  compact?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.7rem] leading-tight text-muted-foreground",
        className
      )}
    >
      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: match.color }}
        />
        <span className="truncate">{matchOwnerText(match)}</span>
      </span>
      {match.common && !compact ? (
        <span className="whitespace-nowrap rounded-full bg-brand-wash px-1.5 text-brand">Em comum</span>
      ) : null}
      {match.suggestionForMe && !compact ? (
        <span className="whitespace-nowrap rounded-full border border-brand-dim px-1.5 text-brand">
          Sugestão para você
        </span>
      ) : null}
    </p>
  )
}

/**
 * "Trazer": leva o item para a A organizar (nome, imagem e localização; sem a
 * nota do outro). Um toque; trazer de novo só avisa que já está lá.
 */
export function BringButton({
  entryId,
  name,
  variant = "card",
  className,
}: {
  entryId: string
  name: string
  /** `card`: o selo flutuante do card; `row`: na ponta da linha; `detail`: botão grande. */
  variant?: "card" | "row" | "detail"
  className?: string
}) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "pending" | "done">("idle")

  async function bring(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (state !== "idle") return
    setState("pending")
    const result = await bringFromMatchAction({ entryId })
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
        ? { action: { label: "Ver", onClick: () => router.push(`/categoria/${target.categoryId}`) } }
        : undefined
    )
  }

  const Icon = state === "done" ? Check : ArrowDownToLine
  const label = state === "done" ? "Trazido" : state === "pending" ? "Trazendo…" : "Trazer"

  if (variant === "detail") {
    return (
      <Button size="lg" onClick={bring} disabled={state !== "idle"} className={className}>
        <Icon className="size-4" /> {label}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={bring}
      disabled={state !== "idle"}
      title={`Trazer “${name}” para a sua A organizar`}
      aria-label={`Trazer ${name} para a sua A organizar`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border text-xs transition-colors disabled:opacity-80",
        variant === "card"
          ? "border-line bg-bg/85 px-2 py-1 backdrop-blur-sm"
          : "border-line px-2 py-1",
        state === "done"
          ? "border-brand-dim text-brand"
          : "text-foreground hover:border-brand-dim hover:text-brand",
        className
      )}
    >
      <Icon className="size-3.5" />
      {/* Na lista do celular, só o ícone: o nome do item precisa do espaço. */}
      <span className={variant === "row" ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  )
}
