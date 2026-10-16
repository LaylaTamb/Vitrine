"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Database,
  LocateFixed,
  MapPin,
  MapPinOff,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EntryForm } from "@/components/entry/entry-form"
import { GlobalFilterSidebar } from "@/components/filter/global-filter-sidebar"
import { useGlobalFilter } from "@/components/filter/use-global-filter"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { runPendingGeocode } from "@/components/map/geocode-runner"
import type { FocusRequest } from "@/components/map/map-canvas"
import { PlaceCard } from "@/components/map/place-card"
import { PlacesList } from "@/components/map/places-list"
import { SuggestionsPanel, createPlaceCache } from "@/components/map/suggestions-panel"
import { UnplacedBlock } from "@/components/map/unplaced-block"
import { useGeolocation } from "@/components/map/use-geolocation"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { activeFilterCount } from "@/lib/domain/filter"
import { plural } from "@/lib/domain/format"
import {
  buildPins,
  hasLocationFields,
  mapScope,
  pendingPlaces,
  pinCountByCategory,
  type UnplacedAddress,
} from "@/lib/domain/map"
import type { Category, EntryPlace, EntryView, Tag } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

// O MapLibre (uns 200 kB) só desce nesta página, e só no navegador.
const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((module) => module.MapCanvas),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> }
)

export type MapTab = "mapa" | "sugestoes"

const TABS: { id: MapTab; label: string }[] = [
  { id: "mapa", label: "Mapa" },
  { id: "sugestoes", label: "Sugestões" },
]

/**
 * A página do Mapa. O filtro (o mesmo do Filtro geral) e a minha posição
 * moram aqui e valem para as duas abas — trocar de aba não perde nada.
 *
 * O mapa fica montado mesmo na aba Sugestões (só escondido): voltar para a
 * aba não baixa tudo de novo.
 */
export function MapView({
  categories,
  views,
  tags,
  places,
  placesReady,
  initialTab,
  focusEntryId,
  initialCategoryId,
}: {
  categories: Category[]
  views: EntryView[]
  tags: Tag[]
  places: EntryPlace[]
  /** `false` = a migração 11 ainda não rodou. */
  placesReady: boolean
  initialTab: MapTab
  /** `?item=<id>`: abre com o pino desse item em foco. */
  focusEntryId: string | null
  /** `?categoria=<id>`: abre com essa categoria marcada no filtro. */
  initialCategoryId: string | null
}) {
  const { actions } = useVitrine()
  // O filtro só oferece o que pode virar pino: categorias com Localização,
  // os itens delas e as tags que eles usam.
  const scope = useMemo(() => mapScope(categories, views, tags), [categories, views, tags])
  const filterState = useGlobalFilter(
    scope.categories,
    scope.views,
    scope.categories.some((category) => category.id === initialCategoryId) && initialCategoryId
      ? [initialCategoryId]
      : []
  )
  const { filter, unified, filtered, active, clearAll } = filterState
  const geo = useGeolocation()
  const mapRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<MapTab>(initialTab)
  // O que já veio da Geoapify nesta visita: sobrevive à troca de abas.
  const [placeCache] = useState(createPlaceCache)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [editing, setEditing] = useState<UnplacedAddress | null>(null)

  const allPins = useMemo(() => buildPins(views, categories, places), [views, categories, places])
  const allUnplaced = useMemo(
    () => pendingPlaces(views, categories, places),
    [views, categories, places]
  )
  const pinCounts = useMemo(() => pinCountByCategory(allPins), [allPins])
  // O filtro decide o universo; os pinos seguem a ordem dele.
  const pins = useMemo(
    () => buildPins(filtered, categories, places),
    [filtered, categories, places]
  )
  const unplaced = useMemo(
    () => pendingPlaces(filtered, categories, places),
    [filtered, categories, places]
  )

  const initialPin = focusEntryId
    ? (allPins.find((pin) => pin.entryId === focusEntryId) ?? null)
    : null
  const [selectedKey, setSelectedKey] = useState<string | null>(initialPin?.key ?? null)
  const [focus, setFocus] = useState<FocusRequest | null>(
    initialPin ? { key: initialPin.key, seq: 1 } : null
  )
  const selectedPin = pins.find((pin) => pin.key === selectedKey) ?? null

  // A aba vai para a URL sem re-executar o Server Component. O `?categoria=`
  // só vale na abertura: depois o filtro é da tela, e a URL não o descreve.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete("categoria")
    if (tab === "mapa") url.searchParams.delete("aba")
    else url.searchParams.set("aba", tab)
    window.history.replaceState(null, "", url.toString())
  }, [tab])

  function pick(key: string) {
    setSelectedKey(key)
    setFocus((current) => ({ key, seq: (current?.seq ?? 0) + 1 }))
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  async function locateMe() {
    const result = await geo.locate()
    if (!result.ok) toast.error(result.error)
  }

  async function retry() {
    setRetrying(true)
    await runPendingGeocode(actions, { mode: "retry" })
    setRetrying(false)
  }

  const ruleCount = activeFilterCount(filter, unified)
  const unplacedEntries = new Set(unplaced.map((item) => item.entryId)).size
  const subtitle = [
    plural(pins.length, "lugar no mapa", "lugares no mapa"),
    unplacedEntries > 0 ? `${plural(unplacedEntries, "item", "itens")} sem pino` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const header = (
    <PageHeader
      label="Seu acervo no mapa"
      title="Mapa"
      subtitle={placesReady && hasLocationFields(categories) ? subtitle : undefined}
      actions={
        active ? (
          <Button variant="outline" size="lg" onClick={clearAll}>
            <X className="size-4" /> Limpar tudo
          </Button>
        ) : null
      }
    />
  )

  if (!placesReady) {
    return (
      <>
        {header}
        <EmptyState
          icon={Database}
          title="O mapa ainda não está no banco"
          description="Rode supabase/11_entry_places.sql no SQL Editor do Supabase e recarregue esta página."
        />
      </>
    )
  }

  if (!hasLocationFields(categories)) {
    return (
      <>
        {header}
        <EmptyState
          icon={MapPin}
          title="Nenhuma categoria tem Localização"
          description="Abra a Estrutura de uma categoria e adicione um campo do tipo “Localização (mapa)” — ou converta para ele um campo de Texto que já tenha endereços. Os itens com endereço aparecem aqui."
          action={
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Ir para as Coleções
            </Link>
          }
        />
      </>
    )
  }

  // Sem pino nenhum na tela: o mapa continua montado e a explicação vai por cima.
  const emptyOverlay =
    pins.length > 0
      ? null
      : active && unplaced.length === 0
        ? {
            title: "Nada bateu com o filtro",
            description: "Nenhum lugar do seu acervo passa por esse recorte.",
            action: (
              <Button variant="outline" onClick={clearAll}>
                Limpar tudo
              </Button>
            ),
          }
        : allUnplaced.length === 0
          ? {
              title: "Nenhum item com endereço ainda",
              description:
                "Preencha o campo de Localização de um item e ele aparece aqui como um pino.",
              action: null,
            }
          : {
              title: "Nenhum endereço localizado ainda",
              description:
                "Os endereços viram pino assim que cada um é encontrado — veja a lista logo abaixo do mapa.",
              action: null,
            }

  return (
    <>
      {header}

      <div className="mb-5 flex items-center gap-1 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === item.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="mapa-filtros"
        >
          <SlidersHorizontal /> Filtros
          {ruleCount > 0 ? (
            <span className="rounded-full bg-brand-wash px-1.5 text-[0.7rem] text-brand">
              {ruleCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
        <aside
          id="mapa-filtros"
          className={cn(
            "space-y-5 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1",
            filtersOpen ? "block" : "hidden"
          )}
        >
          <GlobalFilterSidebar
            state={filterState}
            categories={scope.categories}
            tags={scope.tags}
            categoryCounts={pinCounts}
            showRating={scope.categories.some((category) => category.rating_enabled)}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className={cn(tab === "mapa" ? "space-y-4" : "hidden")}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
              <div
                ref={mapRef}
                className="relative h-[calc(100dvh-15rem)] min-h-80 overflow-hidden rounded-xl border border-line bg-bg-soft lg:h-[36rem]"
              >
                <MapCanvas
                  pins={pins}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  focus={focus}
                  userPosition={geo.position}
                  userPositionSeq={geo.seq}
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={locateMe}
                  disabled={geo.locating}
                  className="absolute left-3 top-3 z-10 bg-surface/95 shadow-lg backdrop-blur-sm"
                >
                  <LocateFixed className={cn(geo.locating && "animate-pulse")} />
                  {geo.locating ? "Localizando…" : "Minha localização"}
                </Button>

                {emptyOverlay ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
                    <EmptyState
                      icon={MapPinOff}
                      title={emptyOverlay.title}
                      description={emptyOverlay.description}
                      action={emptyOverlay.action}
                      className="pointer-events-auto max-w-sm border-solid bg-surface/95 py-8 shadow-2xl backdrop-blur-sm"
                    />
                  </div>
                ) : null}

                {selectedPin ? (
                  <PlaceCard
                    pin={selectedPin}
                    origin={geo.position}
                    onClose={() => setSelectedKey(null)}
                    className="absolute inset-x-3 bottom-3 z-20 sm:left-auto sm:w-[26rem]"
                  />
                ) : null}
              </div>

              <PlacesList
                pins={pins}
                selectedKey={selectedKey}
                origin={geo.position}
                onPick={pick}
                className="max-h-80 xl:h-[36rem] xl:max-h-none"
              />
            </div>

            <UnplacedBlock
              items={unplaced}
              retrying={retrying}
              onRetry={retry}
              onEdit={setEditing}
            />
          </div>

          {/* Montada só com a aba aberta: é isso que garante que a Geoapify não é
              consultada por quem só abriu o Mapa. */}
          {tab === "sugestoes" ? (
            <SuggestionsPanel
              pins={pins}
              position={geo.position}
              positionLabel={geo.label}
              locating={geo.locating}
              onLocate={locateMe}
              onSetPosition={geo.setPosition}
              filterActive={active}
              onClearFilter={clearAll}
              cache={placeCache}
            />
          ) : null}
        </section>
      </div>

      {editing ? (
        <EntryForm
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          categoryId={editing.category.id}
          estrutura={editing.category.estrutura}
          tags={tags}
          entry={editing.view}
          ratingEnabled={editing.category.rating_enabled}
        />
      ) : null}
    </>
  )
}
