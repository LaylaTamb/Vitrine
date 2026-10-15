"use client"

import Link from "next/link"
import { ArrowRight, X } from "lucide-react"

import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { DirectionsLink, OpenInMapsLink } from "@/components/map/maps-links"
import { TagPill } from "@/components/tag/tag-pill"
import { buttonVariants } from "@/components/ui/button"
import { formatDistance } from "@/lib/domain/format"
import { haversine, type LatLng, type MapPin } from "@/lib/domain/map"
import type { MapsTarget } from "@/lib/domain/maps-links"
import { cn } from "@/lib/utils"

/** O destino de um pino para os links do Google Maps: as coordenadas e o texto. */
export function pinTarget(pin: MapPin): MapsTarget {
  return { address: pin.address, lat: pin.lat, lng: pin.lng }
}

/** O cartão do pino tocado: o essencial do item e os atalhos para ir até lá. */
export function PlaceCard({
  pin,
  origin,
  onClose,
  className,
}: {
  pin: MapPin
  /** Minha posição, se eu já informei — vira a origem do "Como chegar". */
  origin: LatLng | null
  onClose: () => void
  className?: string
}) {
  const { view, category } = pin
  const target = pinTarget(pin)

  return (
    <article
      aria-label={view.name}
      className={cn(
        "flex gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur-sm",
        className
      )}
    >
      <EntryImage
        imageUrl={view.imageUrl}
        imageTransform={view.imageTransform}
        initial={view.initial}
        ratio="1 / 1"
        initialSize="1.6rem"
        className="w-16 shrink-0 sm:w-20"
        tint={category.color}
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="plaque truncate">
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
              {pin.fieldLabel !== "Localização" ? ` · ${pin.fieldLabel}` : ""}
            </p>
            <h3 className="display truncate text-lg leading-tight">{view.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar o cartão"
            title="Fechar"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hi hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {category.rating_enabled && view.hasRating ? (
          <span className="flex items-center gap-1.5">
            <Stars percent={view.ratingPercent} size="sm" />
            <span className="text-xs text-muted-foreground">{view.ratingLabel}</span>
          </span>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {pin.address}
          {origin ? (
            <span className="text-faint"> · a {formatDistance(haversine(origin, pin))}</span>
          ) : null}
        </p>

        {view.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {view.tags.slice(0, 4).map((tag) => (
              <TagPill key={tag.id} tag={tag} size="xs" />
            ))}
            {view.tags.length > 4 ? (
              <span className="text-[0.65rem] text-faint">+{view.tags.length - 4}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Link href={view.href} className={buttonVariants({ size: "sm" })}>
            Ver item <ArrowRight />
          </Link>
          <OpenInMapsLink target={target} />
          <DirectionsLink target={target} origin={origin} />
        </div>
      </div>
    </article>
  )
}
