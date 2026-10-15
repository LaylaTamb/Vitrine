"use client"

import { Car, Footprints, LocateFixed, MapPinOff, Search } from "lucide-react"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/layout/empty-state"
import { useStoredPreference } from "@/components/layout/use-stored-preference"
import { SuggestionCard } from "@/components/map/suggestion-card"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDistance, plural } from "@/lib/domain/format"
import { nearby, type LatLng, type MapPin } from "@/lib/domain/map"
import type { TravelMode } from "@/lib/domain/maps-links"
import {
  DEFAULT_RADIUS,
  SUGGESTION_RADII,
  SUGGESTION_SORTS,
  radiusThatReaches,
  sortSuggestions,
  type PlaceDetails,
  type RouteInfo,
  type SuggestionSort,
} from "@/lib/domain/place-details"
import { cn } from "@/lib/utils"

/** Quantos lugares (os mais perto) ganham horário e contato, e trajeto pelas ruas. */
const DETAILS_LIMIT = 20
const ROUTES_LIMIT = 10

const MODE_STORAGE_KEY = "vitrine:mapa:trajeto"

function parseMode(raw: string | null): TravelMode | null {
  return raw === "walking" || raw === "driving" ? raw : null
}

/**
 * O que já veio da Geoapify nesta visita — mora no Mapa (não aqui), para trocar
 * de aba e voltar não pedir tudo de novo.
 */
export interface PlaceCache {
  /** place_id → dados (`null` = não há dados do lugar). */
  details: Map<string, PlaceDetails | null>
  /** place_id que falharam agora (cota, rede…): o cartão avisa. */
  failedDetails: Set<string>
  /** `modo|origem|pino` → trajeto (`null` = sem rota). */
  routes: Map<string, RouteInfo | null>
  failedRoutes: Set<string>
}

export function createPlaceCache(): PlaceCache {
  return { details: new Map(), failedDetails: new Set(), routes: new Map(), failedRoutes: new Set() }
}

/**
 * A aba Sugestões: entre os itens que passam pelo filtro, os que ficam perto
 * de mim. A lista sai na hora, só com a memória do navegador; os dados do
 * lugar (dos 20 mais perto) e o trajeto (dos 10 mais perto) chegam depois.
 *
 * A Geoapify só é consultada com esta aba aberta, e só quando muda a posição,
 * o raio, o modo de trajeto ou o recorte — nunca por abrir a página do Mapa.
 */
export function SuggestionsPanel({
  pins,
  position,
  positionLabel,
  locating,
  onLocate,
  onSetPosition,
  filterActive,
  onClearFilter,
  cache,
}: {
  /** Os pinos que passam pelo filtro de agora. */
  pins: MapPin[]
  position: LatLng | null
  positionLabel: string | null
  locating: boolean
  onLocate: () => void
  onSetPosition: (position: LatLng, label: string) => void
  filterActive: boolean
  onClearFilter: () => void
  cache: PlaceCache
}) {
  const { actions } = useVitrine()
  const [radius, setRadius] = useState(DEFAULT_RADIUS)
  const [sort, setSort] = useState<SuggestionSort>("distance")
  const [mode, setMode] = useStoredPreference<TravelMode>(MODE_STORAGE_KEY, "walking", parseMode)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [routesLoading, setRoutesLoading] = useState(false)
  // O cache é mutável (mora no estado do Mapa): isto avisa o React que ele mudou.
  const [, refresh] = useReducer((count: number) => count + 1, 0)

  const all = useMemo(() => (position ? nearby(pins, position) : []), [pins, position])
  const inside = useMemo(() => all.filter((item) => item.distance <= radius), [all, radius])

  const originKey = position ? `${position.lat.toFixed(4)},${position.lng.toFixed(4)}` : ""
  const routeKey = (pinKey: string) => `${mode}|${originKey}|${pinKey}`

  // `inside` vem do mais perto ao mais longe: é daí que saem os 20 e os 10.
  const detailsTargets = new Set(inside.slice(0, DETAILS_LIMIT).map((item) => item.pin.key))
  const routesTargets = new Set(inside.slice(0, ROUTES_LIMIT).map((item) => item.pin.key))

  // ---- dados do lugar: os 20 mais perto, só o que ainda não veio ---------
  const missingDetails = new Set<string>()
  for (const item of inside.slice(0, DETAILS_LIMIT)) {
    const placeId = item.pin.placeId
    if (placeId && !cache.details.has(placeId) && !cache.failedDetails.has(placeId)) {
      missingDetails.add(placeId)
    }
  }
  const detailsRequest = [...missingDetails].join(",")

  useEffect(() => {
    if (!detailsRequest) return
    let current = true
    const placeIds = detailsRequest.split(",")
    setDetailsLoading(true)
    void actions.placeDetails({ placeIds }).then((result) => {
      if (result.ok) {
        const details = result.data?.details ?? {}
        for (const id of placeIds) {
          if (id in details) cache.details.set(id, details[id])
          else cache.failedDetails.add(id)
        }
      } else {
        for (const id of placeIds) cache.failedDetails.add(id)
      }
      if (current) setDetailsLoading(false)
      refresh()
    })
    return () => {
      current = false
    }
  }, [actions, cache, detailsRequest])

  // ---- trajeto: os 10 mais perto, no modo escolhido -----------------------
  const routeTargets = inside
    .slice(0, ROUTES_LIMIT)
    .filter(
      (item) => !cache.routes.has(routeKey(item.pin.key)) && !cache.failedRoutes.has(routeKey(item.pin.key))
    )
  const routesRequest = routeTargets.map((item) => item.pin.key).join(",")
  const latest = useRef({ position, routeTargets, mode, originKey })
  latest.current = { position, routeTargets, mode, originKey }

  useEffect(() => {
    const { position: origin, routeTargets: targets, mode: travelMode, originKey: originId } =
      latest.current
    if (!origin || !routesRequest || targets.length === 0) return
    let current = true
    const keyOf = (pinKey: string) => `${travelMode}|${originId}|${pinKey}`
    setRoutesLoading(true)
    void actions
      .routeTimes({
        origin,
        destinations: targets.map((item) => ({ key: item.pin.key, lat: item.pin.lat, lng: item.pin.lng })),
        mode: travelMode,
      })
      .then((result) => {
        for (const item of targets) {
          const route = result.ok ? result.data?.routes[item.pin.key] : undefined
          if (route === undefined) cache.failedRoutes.add(keyOf(item.pin.key))
          else cache.routes.set(keyOf(item.pin.key), route)
        }
        if (current) setRoutesLoading(false)
        refresh()
      })
    return () => {
      current = false
    }
  }, [actions, cache, routesRequest])

  async function searchAddress(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const result = await actions.geocodeAddress({ query })
    setSearching(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.data) onSetPosition({ lat: result.data.lat, lng: result.data.lng }, result.data.label)
  }

  const items = sortSuggestions(
    inside.map((item) => ({
      ...item,
      myRating: item.pin.category.rating_enabled ? item.pin.view.rating : null,
    })),
    sort
  )
  const detailsFailed = items.some(
    (item) => item.pin.placeId !== null && cache.failedDetails.has(item.pin.placeId)
  )

  const nearest = all[0]
  const reach = nearest ? radiusThatReaches(nearest.distance) : null

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="space-y-2">
          <p className="plaque">Onde estou</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onLocate} disabled={locating}>
              <LocateFixed className={cn(locating && "animate-pulse")} />
              {locating ? "Localizando…" : "Usar minha localização"}
            </Button>
            <form onSubmit={searchAddress} className="flex min-w-60 flex-1 items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ou digite um endereço"
                aria-label="Endereço de onde você está"
                maxLength={300}
                className="h-8"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={searching || !query.trim()}>
                <Search /> {searching ? "Buscando…" : "Buscar"}
              </Button>
            </form>
          </div>
          {position ? (
            <p className="text-xs text-muted-foreground">
              Perto de: <span className="text-foreground">{positionLabel ?? "este ponto"}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="space-y-1.5">
            <span className="plaque block">Raio</span>
            <div role="group" aria-label="Raio" className="inline-flex flex-wrap rounded-md border border-line bg-bg-soft p-0.5 text-xs">
              {SUGGESTION_RADII.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRadius(value)}
                  aria-pressed={radius === value}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    radius === value
                      ? "bg-brand-wash text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {formatDistance(value)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sugestoes-ordem" className="plaque">
              Ordenar por
            </Label>
            <select
              id="sugestoes-ordem"
              value={sort}
              onChange={(event) => setSort(event.target.value as SuggestionSort)}
              className="h-8 rounded-md border border-line bg-bg-soft px-2 text-sm outline-none focus-visible:border-brand-dim"
            >
              {SUGGESTION_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="plaque block">Trajeto</span>
            <div role="group" aria-label="Trajeto" className="inline-flex rounded-md border border-line bg-bg-soft p-0.5 text-xs">
              {(
                [
                  { value: "walking", label: "A pé", Icon: Footprints },
                  { value: "driving", label: "Carro", Icon: Car },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 transition-colors",
                    mode === value
                      ? "bg-brand-wash text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!position ? (
        <EmptyState
          icon={LocateFixed}
          title="Onde você está?"
          description="Use a sua localização ou digite um endereço: aparecem os lugares que você já salvou perto dali, do mais perto ao mais longe."
        />
      ) : pins.length === 0 ? (
        filterActive ? (
          <EmptyState
            icon={MapPinOff}
            title="Nada bateu com o filtro"
            description="Nenhum lugar do seu acervo passa por esse recorte."
            action={
              <Button variant="outline" onClick={onClearFilter}>
                Limpar tudo
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MapPinOff}
            title="Nenhum lugar no mapa ainda"
            description="Os itens com endereço localizado aparecem aqui."
          />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={MapPinOff}
          title="Nada seu perto daqui"
          description={
            nearest
              ? `Nenhum lugar até ${formatDistance(radius)}. O mais perto fica a ${formatDistance(nearest.distance)}.`
              : `Nenhum lugar até ${formatDistance(radius)}.`
          }
          action={
            reach ? (
              <Button variant="outline" onClick={() => setRadius(reach)}>
                Aumentar o raio para {formatDistance(reach)}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {plural(items.length, "lugar", "lugares")} até {formatDistance(radius)}
              {items.length > DETAILS_LIMIT
                ? ` · horário e contato dos ${DETAILS_LIMIT} mais perto`
                : ""}
            </p>
            {detailsFailed ? (
              <p className="text-xs text-faint">Horário e contato indisponíveis agora para alguns lugares.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((item) => {
              const { placeId, key } = item.pin
              const failed = placeId !== null && cache.failedDetails.has(placeId)
              const route = cache.routes.get(routeKey(key))
              return (
                <SuggestionCard
                  key={key}
                  pin={item.pin}
                  distance={item.distance}
                  details={placeId ? cache.details.get(placeId) : undefined}
                  detailsLoading={
                    placeId !== null && detailsTargets.has(key) && detailsLoading && !failed
                  }
                  route={route}
                  routeLoading={
                    routesTargets.has(key) &&
                    routesLoading &&
                    route === undefined &&
                    !cache.failedRoutes.has(routeKey(key))
                  }
                  unavailable={failed}
                  mode={mode}
                  origin={position}
                />
              )
            })}
          </div>
          <p className="text-[0.7rem] text-faint">
            Horário, tipo e contato:{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-muted-foreground hover:underline"
            >
              © OpenStreetMap
            </a>
            {" · "}
            <a
              href="https://www.geoapify.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-muted-foreground hover:underline"
            >
              Powered by Geoapify
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
