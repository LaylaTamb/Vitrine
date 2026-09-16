"use client"

import type { Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/**
 * A pílula de tag, na cor da própria tag.
 *
 * Sem `onClick` é só um selo; com `onClick` vira um alternador (a barra de
 * filtros e o formulário de item usam os dois modos).
 */
export function TagPill({
  tag,
  active,
  onClick,
  size = "sm",
  className,
}: {
  tag: Pick<Tag, "id" | "name" | "color">
  active?: boolean
  onClick?: () => void
  size?: "xs" | "sm"
  className?: string
}) {
  const style = active
    ? { borderColor: tag.color, backgroundColor: `${tag.color}24`, color: tag.color }
    : { borderColor: `${tag.color}55`, color: `${tag.color}dd` }

  const classes = cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border transition-colors",
    size === "xs" ? "px-1.5 py-0 text-[0.65rem]" : "px-2 py-0.5 text-xs",
    onClick && "cursor-pointer hover:brightness-125",
    className
  )

  const content = (
    <>
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <span className="max-w-32 truncate">{tag.name}</span>
    </>
  )

  if (!onClick) {
    return (
      <span className={classes} style={style}>
        {content}
      </span>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={classes} style={style}>
      {content}
    </button>
  )
}
