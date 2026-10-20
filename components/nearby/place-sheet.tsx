"use client"

import Link from "next/link"
import { Inbox, MapPin, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { addNearbyPlaceAction, placeRatingsAction } from "@/app/mapa/actions"
import { StarInput } from "@/components/entry/stars"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatRating, plural } from "@/lib/domain/format"
import { haversine, type LatLng } from "@/lib/domain/map"
import {
  distanceLabel,
  EMPTY_RATINGS,
  type NearbyPlace,
  type PlaceRatings,
  type PlaceTarget,
} from "@/lib/domain/nearby"
import { openingStatus } from "@/lib/domain/place-details"
import { profilePath } from "@/lib/domain/username"
import { cn } from "@/lib/utils"

/**
 * O cartão de um lugar por perto: o que é, o horário (do OpenStreetMap) e,
 * "No Vitrine", quem avaliou — só o que você pode ver, sem texto livre. Em
 * "Adicionar", a nota é opcional e tocar numa categoria já salva.
 */
export function PlaceSheet({
  place,
  position,
  targets,
  onClose,
}: {
  place: NearbyPlace
  /** De onde a busca partiu (a posição de quem abriu). */
  position: LatLng
  targets: PlaceTarget[]
  onClose: () => void
}) {
  const router = useRouter()
  const [ratings, setRatings] = useState<PlaceRatings | null>(null)
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    void placeRatingsAction({ placeId: place.placeId, osmId: place.osmId }).then((result) => {
      if (alive) setRatings(result.ok && result.data ? result.data : EMPTY_RATINGS)
    })
    return () => {
      alive = false
    }
  }, [place.placeId, place.osmId])

  const status = openingStatus(place.periods, place.utcOffsetMinutes, now)
  const subtitle = [place.typeLabel, distanceLabel(haversine(position, place))]
    .filter(Boolean)
    .join(" · ")

  async function add(target: PlaceTarget) {
    setSaving(target.id)
    const result = await addNearbyPlaceAction({
      lat: position.lat,
      lng: position.lng,
      placeId: place.placeId,
      categoryId: target.id,
      rating: rating > 0 ? rating : null,
    })
    setSaving(null)
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Não deu para salvar agora." : result.error)
      return
    }
    const { categoryId, categoryName } = result.data
    toast.success(`“${place.name}” salvo em ${categoryName}.`, {
      action: { label: "Ver", onClick: () => router.push(`/categoria/${categoryId}`) },
    })
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      {/* [&>*]:min-w-0: sem ele, um @ comprido esticava a grade do diálogo além da tela. */}
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="display text-xl break-words">{place.name}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          {place.address ? <p className="text-muted-foreground">{place.address}</p> : null}
          {status ? (
            <p className={status.open ? "text-brand" : "text-muted-foreground"}>{status.label}</p>
          ) : place.openingHoursText ? (
            <p className="text-muted-foreground">Horário: {place.openingHoursText}</p>
          ) : null}
        </div>

        <section className="space-y-2">
          <p className="plaque">No Vitrine</p>
          {ratings === null ? (
            <p className="text-sm text-muted-foreground">Procurando quem avaliou…</p>
          ) : ratings.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém avaliou ainda — pelo menos ninguém que você possa ver.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                <Star aria-hidden className="size-4 fill-current text-brand" />
                {ratings.average !== null ? formatRating(ratings.average) : "—"}
                <span className="text-muted-foreground">
                  · {plural(ratings.count, "avaliação", "avaliações")}
                </span>
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Quem avaliou">
                {ratings.ratings.map((entry) => (
                  <li key={entry.username}>
                    <Link
                      href={profilePath(entry.username)}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-foreground hover:border-brand-dim hover:text-foreground"
                    >
                      <span className="min-w-0 truncate">
                        {entry.isMe ? "você" : `@${entry.username}`}
                      </span>
                      <span className="text-brand">★ {formatRating(entry.rating)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {ratings && ratings.mine.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Já está em{" "}
              {ratings.mine.map((item, index) => (
                <span key={item.entryId}>
                  {index > 0 ? ", " : ""}
                  <Link
                    href={`/categoria/${item.categoryId}/${item.entryId}`}
                    className="text-foreground underline underline-offset-2"
                  >
                    {item.categoryName}
                  </Link>
                </span>
              ))}
              .
            </p>
          ) : null}
        </section>

        <section className="space-y-2 border-t border-line pt-4">
          <p className="plaque">Adicionar</p>
          <div className="flex items-center gap-2">
            <StarInput value={rating} onChange={setRating} size="lg" />
            <span className="text-xs text-faint">
              {rating > 0 ? formatRating(rating) : "Sua nota (opcional)"}
            </span>
          </div>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crie uma categoria nas Coleções para poder salvar lugares.
            </p>
          ) : (
            <>
              <p className="text-xs text-faint">Toque na categoria para salvar.</p>
              <ul className="space-y-1.5">
                {targets.map((target) => (
                  <li key={target.id}>
                    <button
                      type="button"
                      onClick={() => add(target)}
                      disabled={saving !== null}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left text-sm transition-colors hover:border-brand-dim disabled:opacity-60",
                        saving === target.id && "border-brand-dim bg-brand-wash"
                      )}
                    >
                      <span aria-hidden className="shrink-0">
                        {target.inbox ? (
                          <Inbox className="size-4 text-brand" />
                        ) : (
                          target.icon || "📁"
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{target.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-faint">
                        {saving === target.id ? (
                          "Salvando…"
                        ) : target.hasLocation ? (
                          <>
                            <MapPin aria-hidden className="size-3" /> com o endereço
                          </>
                        ) : (
                          "só o nome"
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
