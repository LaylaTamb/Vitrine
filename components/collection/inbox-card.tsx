import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { VISIBILITY_ICONS } from "@/components/collection/privacy-switch"
import { itemCount } from "@/lib/domain/format"
import { INBOX_ICON } from "@/lib/domain/inbox"
import { visibilityLabel, visibilityOf } from "@/lib/domain/privacy"
import type { Category } from "@/lib/domain/types"

/**
 * A "A organizar" no topo das Coleções: lugar fixo, cara de caixa de entrada,
 * sem arrastar nem editar. Leva à categoria, onde os itens são movidos.
 */
export function InboxCard({
  category,
  count,
  href,
  canEdit,
}: {
  category: Category
  count: number
  href: string
  canEdit: boolean
}) {
  const visibility = visibilityOf(category)
  const LevelIcon = VISIBILITY_ICONS[visibility]
  const label = visibilityLabel("category", visibility)
  const subtitle =
    count === 0
      ? canEdit
        ? "Vazia. O que você salvar às pressas cai aqui."
        : "Vazia."
      : canEdit
        ? `${itemCount(count)} esperando uma categoria`
        : `${itemCount(count)} ainda sem categoria`

  return (
    <Link
      href={href}
      className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-brand-dim bg-brand-wash px-4 py-3 transition-colors hover:border-brand"
    >
      <span aria-hidden className="text-2xl leading-none">
        {category.icon || INBOX_ICON}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="display block truncate text-lg leading-snug">{category.name}</span>
          {canEdit && visibility !== "public" ? (
            <LevelIcon role="img" aria-label={label} className="size-3.5 shrink-0 text-faint">
              <title>{label}</title>
            </LevelIcon>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
