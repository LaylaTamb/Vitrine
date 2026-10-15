"use client"

import Link from "next/link"
import { ArrowRight, Globe, Phone } from "lucide-react"

import { EntryImage } from "@/components/entry/entry-image"
import { Stars } from "@/components/entry/stars"
import { DirectionsLink, OpenInMapsLink } from "@/components/map/maps-links"
import { pinTarget } from "@/components/map/place-card"
import { TagPill } from "@/components/tag/tag-pill"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistance } from "@/lib/domain/format"
import type { LatLng, MapPin } from "@/lib/domain/map"
import type { TravelMode } from "@/lib/domain/maps-links"
import { humanizeOpeningHours } from "@/lib/domain/opening-hours"
import {
  formatDuration,
  myPriceOf,
  openingStatus,
  type PlaceDetails,
  type RouteInfo,
} from "@/lib/domain/place-details"
import { ruleSummary } from "@/lib/domain/place-summary"
import { cn } from "@/lib/utils"

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Um lugar salvo perto de mim, com o que ajuda a decidir. O que é meu
 * (nome, categoria, nota, tags, distância, preço anotado) aparece na hora; o
 * que vem do OpenStreetMap via Geoapify (o que é, horário, telefone, site,
 * trajeto pelas ruas) chega depois, com esqueleto — e só quando alguém
 * cadastrou isso no OSM.
 */
export function SuggestionCard({
  pin,
  distance,
  details,
  detailsLoading,
  route,
  routeLoading,
  unavailable,
  mode,
  origin,
}: {
  pin: MapPin
  /** Em linha reta, em metros. */
  distance: number
  /** `undefined` = ainda não chegou (ou não foi pedido); `null` = não há dados do lugar. */
  details: PlaceDetails | null | undefined
  detailsLoading: boolean
  route: RouteInfo | null | undefined
  routeLoading: boolean
  /** A busca falhou para este lugar agora: mostra só o que é meu. */
  unavailable: boolean
  mode: TravelMode
  origin: LatLng
}) {
  const { view, category } = pin
  const target = pinTarget(pin)
  const myRating = category.rating_enabled ? view.rating : null
  const opening = details ? openingStatus(details.periods, details.utcOffsetMinutes, Date.now()) : null
  const hoursText =
    !opening && details?.openingHoursText ? humanizeOpeningHours(details.openingHoursText) : null
  const myPrice = myPriceOf(view)
  const summary = ruleSummary({
    typeLabel: details?.typeLabel ?? null,
    distance,
    myRating,
    tags: view.tags.map((tag) => tag.name),
    notes: view.summary,
  })
  const waiting = detailsLoading && details === undefined

  return (
    <article
      aria-label={view.name}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex gap-3">
        <EntryImage
          imageUrl={view.imageUrl}
          imageTransform={view.imageTransform}
          initial={view.initial}
          ratio="1 / 1"
          initialSize="1.6rem"
          className="w-16 shrink-0"
          tint={category.color}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="plaque truncate">
            {category.icon ? `${category.icon} ` : ""}
            {category.name}
            {details?.typeLabel ? ` · ${details.typeLabel}` : ""}
          </p>
          <h3 className="display truncate text-lg leading-tight">{view.name}</h3>
          <p className="text-xs text-muted-foreground">
            {formatDistance(distance)} em linha reta
            {route ? (
              <span className="text-foreground">
                {" "}
                · {formatDuration(route.durationSeconds)} {mode === "walking" ? "a pé" : "de carro"} (
                {formatDistance(route.distanceMeters)})
              </span>
            ) : routeLoading ? (
              <span
                aria-label="Calculando o trajeto"
                className="ml-1.5 inline-block h-3 w-24 animate-pulse rounded-md bg-muted align-middle"
              />
            ) : null}
          </p>
        </div>
      </div>

      {waiting ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      )}

      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        {waiting ? (
          <>
            <dt className="plaque pt-px">Horário</dt>
            <dd>
              <Skeleton className="h-3.5 w-36" />
            </dd>
          </>
        ) : opening || hoursText ? (
          <>
            <dt className="plaque pt-px">Horário</dt>
            <dd>
              {opening ? (
                <span className={cn(opening.open ? "text-foreground" : "text-danger")}>
                  {opening.label}
                </span>
              ) : (
                <span className="text-muted-foreground">{hoursText}</span>
              )}
            </dd>
          </>
        ) : null}

        {myPrice ? (
          <>
            <dt className="plaque pt-px">Preço</dt>
            <dd className="text-muted-foreground">Seu registro: {myPrice}</dd>
          </>
        ) : null}

        {myRating !== null ? (
          <>
            <dt className="plaque pt-px">Minha nota</dt>
            <dd className="flex items-center gap-1.5">
              <Stars percent={view.ratingPercent} size="sm" />
              <span>{view.ratingLabel}</span>
            </dd>
          </>
        ) : null}

        {view.tags.length > 0 ? (
          <>
            <dt className="plaque pt-px">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {view.tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} size="xs" />
              ))}
            </dd>
          </>
        ) : null}

        {details?.phone ? (
          <>
            <dt className="plaque pt-px">Telefone</dt>
            <dd>
              <a
                href={`tel:${details.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <Phone className="size-3" /> {details.phone}
              </a>
            </dd>
          </>
        ) : null}

        {details?.website ? (
          <>
            <dt className="plaque pt-px">Site</dt>
            <dd className="min-w-0">
              <a
                href={details.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-brand hover:underline"
              >
                <Globe className="size-3 shrink-0" />{" "}
                <span className="truncate">{hostOf(details.website)}</span>
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      {unavailable ? (
        <p className="text-[0.7rem] text-faint">
          Horário e contato indisponíveis agora — aparecem de novo na próxima busca.
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <Link href={view.href} className={buttonVariants({ size: "sm" })}>
          Ver item <ArrowRight />
        </Link>
        <OpenInMapsLink target={target} />
        <DirectionsLink target={target} origin={origin} travelMode={mode} />
      </div>
    </article>
  )
}
