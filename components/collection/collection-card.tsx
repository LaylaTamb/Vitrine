"use client"

import { useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Link from "next/link"
import { Folder, FolderOpen, GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { VISIBILITY_ICONS } from "@/components/collection/privacy-switch"
import { FavoriteToggle } from "@/components/favorites/favorite-star"
import type { ViewMode } from "@/components/layout/view-toggle"
import { intoTargetId } from "@/lib/domain/drag"
import { visibilityLabel, type Visibility } from "@/lib/domain/privacy"
import { cn } from "@/lib/utils"

export interface CollectionCardProps {
  id: string
  kind: "folder" | "category"
  name: string
  icon: string | null
  subtitle: string
  href?: string
  onOpen?: () => void
  sortable: boolean
  view: ViewMode
  /**
   * Pasta que recebe o que é arrastado para cima dela (soltar no miolo do card
   * põe dentro). Só vale dentro de um `DndContext`.
   */
  dropInto?: boolean
  /** A categoria tem a estrela (só o dono recebe). */
  favorite?: boolean
  /** Com ela, a estrela fica sempre à vista no card (só categoria, só o dono). */
  onToggleFavorite?: () => void
  /**
   * O nível, para o ícone ao lado do nome: cadeado na Privada, pessoas na de
   * Amigos, nada na Pública. Só o dono passa (e chega a ver).
   */
  visibility?: Visibility
  /** Categoria: até 3 fotos dos itens para a capa (migração 40). Sem elas, o ícone grande. */
  cover?: string[]
  /** Pasta: os ícones do que está dentro, para a capa. */
  glyphs?: string[]
}

export function CollectionCard({
  id,
  kind,
  name,
  icon,
  subtitle,
  href,
  onOpen,
  sortable,
  view,
  dropInto = false,
  favorite = false,
  onToggleFavorite,
  visibility = "public",
  cover,
  glyphs,
}: CollectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  })

  // O miolo do card (não a borda): a borda continua servindo para reordenar.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: intoTargetId(id),
    disabled: !dropInto,
  })

  const glyph = kind === "folder" ? "📁" : (icon ?? "")
  const isList = view === "list"

  const star = onToggleFavorite ? (
    <FavoriteToggle
      active={favorite}
      name={name}
      onToggle={onToggleFavorite}
      className={cn("z-10 shrink-0", !isList && "absolute right-2 top-2")}
    />
  ) : null

  const handle = sortable ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${name}`}
      title="Arraste para reordenar ou para dentro de uma pasta"
      className={cn(
        // Em tela de toque a alça fica à vista: é por ela que se arrasta.
        "card-actions absolute left-2 top-2 z-10 cursor-grab touch-none rounded-lg bg-bg/80 p-1 text-muted-foreground backdrop-blur-sm hover:text-foreground active:cursor-grabbing [@media(hover:none)]:opacity-100",
        isList && "relative left-auto top-auto z-auto bg-transparent text-faint backdrop-blur-none"
      )}
    >
      <GripVertical className="size-4" />
    </button>
  ) : null

  const bodyClass = cn(
    "flex min-w-0 flex-1 outline-none",
    isList ? "items-center gap-3" : "flex-col"
  )

  const body =
    kind === "folder" ? (
      <button type="button" onClick={onOpen} className={cn(bodyClass, "text-left")}>
        <CardFace
          glyph={glyph}
          name={name}
          subtitle={subtitle}
          view={view}
          kind={kind}
          visibility={visibility}
          cover={cover}
          glyphs={glyphs}
        />
      </button>
    ) : (
      <Link href={href ?? "#"} className={bodyClass}>
        <CardFace
          glyph={glyph}
          name={name}
          subtitle={subtitle}
          view={view}
          kind={kind}
          visibility={visibility}
          cover={cover}
          glyphs={glyphs}
        />
      </Link>
    )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/card vitrine-card relative",
        isList ? "flex items-center gap-2 px-3 py-2.5" : "flex flex-col overflow-hidden",
        isDragging && "z-10 border-line-hi opacity-90",
        isOver && "border-brand ring-2 ring-brand-dim"
      )}
    >
      {dropInto ? (
        <div ref={setDropRef} aria-hidden className="pointer-events-none absolute inset-[20%]" />
      ) : null}
      {isList ? (
        <>
          {handle}
          {body}
          {star}
        </>
      ) : (
        <>
          {handle}
          {star}
          {body}
        </>
      )}
    </div>
  )
}

function CardFace({
  glyph,
  name,
  subtitle,
  view,
  kind,
  visibility,
  cover,
  glyphs,
}: {
  glyph: string
  name: string
  subtitle: string
  view: ViewMode
  kind: "folder" | "category"
  visibility: Visibility
  cover?: string[]
  glyphs?: string[]
}) {
  const LevelIcon = VISIBILITY_ICONS[visibility]
  const label = visibilityLabel(kind, visibility)
  const lock =
    visibility === "public" ? null : (
      <LevelIcon role="img" aria-label={label} className="size-3.5 shrink-0 text-faint">
        <title>{label}</title>
      </LevelIcon>
    )

  if (view === "list") {
    return (
      <>
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg">
          {kind === "category" && cover?.[0] ? (
            <CoverImage url={cover[0]} />
          ) : (
            glyph || <FolderOpen className="size-4 text-faint" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="display block truncate text-base">{name}</span>
          {lock}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{subtitle}</span>
      </>
    )
  }

  const photos = kind === "category" ? (cover ?? []).slice(0, 3) : []
  return (
    <>
      {photos.length > 0 ? (
        <CoverMosaic photos={photos} />
      ) : (
        <span className="flex aspect-[4/3] items-center justify-center gap-2 bg-gradient-to-br from-surface-hi to-bg-soft">
          {kind === "folder" ? (
            (glyphs?.length ? glyphs : ["📁"]).map((item, index) => (
              <span
                key={index}
                className="flex size-11 items-center justify-center rounded-xl bg-bg/60 text-xl leading-none"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-4xl leading-none">{glyph || "▫"}</span>
          )}
        </span>
      )}
      <span className="flex min-w-0 items-center gap-2 p-3">
        {kind === "folder" ? (
          <Folder aria-hidden className="size-4 shrink-0 text-brand" />
        ) : glyph && photos.length > 0 ? (
          <span aria-hidden className="shrink-0 text-lg leading-none">
            {glyph}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="display block truncate text-[1.05rem] leading-snug">{name}</span>
            {lock}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </span>
    </>
  )
}

/** A capa: 1 foto inteira; 2 lado a lado; 3 com a primeira grande à esquerda. */
export function CoverMosaic({ photos }: { photos: string[] }) {
  const shown = photos.slice(0, 3)
  return (
    <span
      className={cn(
        "grid aspect-[4/3] gap-0.5 overflow-hidden bg-bg-soft",
        shown.length === 1 ? "grid-cols-1" : "grid-cols-2",
        shown.length === 3 && "grid-rows-2"
      )}
    >
      {shown.map((url, index) => (
        <CoverImage
          key={`${index}-${url}`}
          url={url}
          className={shown.length === 3 && index === 0 ? "row-span-2" : undefined}
        />
      ))}
    </span>
  )
}

/** Uma foto da capa. Link morto vira o fundo da capa, sem o ícone de imagem quebrada. */
export function CoverImage({ url, className }: { url: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)

  // O `error` da <img> pode disparar antes da hidratação prender o listener
  // (como no EntryImage): confere o estado real depois de montar.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth === 0) setFailed(true)
  }, [url])

  if (failed) return <span className={cn("bg-surface-hi", className)} />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, sem otimizador
    <img
      ref={ref}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", className)}
    />
  )
}
