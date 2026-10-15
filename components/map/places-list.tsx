"use client"

import { EntryImage } from "@/components/entry/entry-image"
import { formatDistance, plural } from "@/lib/domain/format"
import { haversine, type LatLng, type MapPin } from "@/lib/domain/map"
import { cn } from "@/lib/utils"

/**
 * Os lugares filtrados, em lista — a alternativa acessível ao mapa. Tocar
 * numa linha leva a câmera até o pino e abre o cartão. Com a minha posição,
 * a lista vem do mais perto ao mais longe.
 */
export function PlacesList({
  pins,
  selectedKey,
  origin,
  onPick,
  className,
}: {
  pins: MapPin[]
  selectedKey: string | null
  origin: LatLng | null
  onPick: (key: string) => void
  className?: string
}) {
  const rows = origin
    ? pins
        .map((pin) => ({ pin, distance: haversine(origin, pin) }))
        .sort((a, b) => a.distance - b.distance)
    : pins.map((pin) => ({ pin, distance: null }))

  return (
    <section
      aria-label="Lugares no mapa"
      className={cn("flex min-h-0 flex-col rounded-xl border border-line bg-surface", className)}
    >
      <p className="plaque px-3 pb-1 pt-3">{plural(pins.length, "lugar", "lugares")}</p>
      {pins.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-faint">Nenhum pino com o filtro de agora.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {rows.map(({ pin, distance }) => (
            <li key={pin.key}>
              <button
                type="button"
                onClick={() => onPick(pin.key)}
                aria-pressed={pin.key === selectedKey}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                  pin.key === selectedKey ? "bg-brand-wash" : "hover:bg-surface-hi"
                )}
              >
                <EntryImage
                  imageUrl={pin.view.imageUrl}
                  imageTransform={pin.view.imageTransform}
                  initial={pin.view.initial}
                  ratio="1 / 1"
                  initialSize="0.95rem"
                  className="w-9 shrink-0"
                  tint={pin.category.color}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{pin.view.name}</span>
                  <span className="block truncate text-[0.7rem] text-muted-foreground">
                    {pin.category.icon ? `${pin.category.icon} ` : ""}
                    {pin.address}
                  </span>
                </span>
                {distance !== null ? (
                  <span className="shrink-0 text-[0.7rem] text-faint">{formatDistance(distance)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
