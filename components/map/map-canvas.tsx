"use client"

import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import Supercluster, { type ClusterProperties, type PointFeature } from "supercluster"
import { useEffect, useRef, useState } from "react"

import type { LatLng, MapPin } from "@/lib/domain/map"

/**
 * O mapa: MapLibre GL com o estilo escuro do OpenFreeMap (OpenStreetMap) —
 * grátis, sem chave e sem limite de uso. Carregado com `next/dynamic`
 * (`ssr: false`) só na página do Mapa.
 *
 * Pinos próximos viram um círculo com a contagem (supercluster); tocar no
 * círculo aproxima. A câmera enquadra os pinos ao abrir e a cada mudança de
 * filtro — nunca porque eu arrastei o mapa.
 */

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark"

/** Onde o mapa abre antes de enquadrar os pinos: o centro de São Paulo. */
const DEFAULT_CENTER: LatLng = { lat: -23.5505, lng: -46.6333 }

/** Exigido pelos termos: quem localiza os endereços e de onde vêm os dados. */
const ATTRIBUTION =
  'Endereços: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a>'

// Classes escritas por inteiro: o Tailwind só gera o que aparece no código.
const PIN_CLASS =
  "flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-bg text-base shadow-lg transition-transform data-[selected=true]:z-10 data-[selected=true]:scale-125 data-[selected=true]:border-foreground"
const CLUSTER_CLASS =
  "flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-bg bg-brand text-sm font-semibold text-primary-foreground shadow-lg"
const HERE_CLASS = "block size-4 rounded-full border-2 border-foreground bg-here ring-8 ring-here/25"

/** Um pedido para levar a câmera até um pino — `seq` repete o mesmo pino. */
export interface FocusRequest {
  key: string
  seq: number
}

type PinFeature = PointFeature<{ key: string }>

function pinElement(pin: MapPin, onSelect: (key: string) => void): HTMLElement {
  const element = document.createElement("button")
  element.type = "button"
  element.className = PIN_CLASS
  element.style.background = pin.category.color ?? "var(--brand)"
  element.textContent = pin.category.icon ?? "•"
  const label = `${pin.view.name} — ${pin.category.name}`
  element.title = label
  element.setAttribute("aria-label", label)
  element.addEventListener("click", (event) => {
    // Sem isto o clique chega ao mapa, que fecha o cartão.
    event.stopPropagation()
    onSelect(pin.key)
  })
  return element
}

function removeAll(markers: Map<string, maplibregl.Marker>) {
  for (const marker of markers.values()) marker.remove()
  markers.clear()
}

function clusterElement(count: number, onClick: () => void): HTMLElement {
  const element = document.createElement("button")
  element.type = "button"
  element.className = CLUSTER_CLASS
  element.textContent = String(count)
  const label = `${count} lugares — toque para aproximar`
  element.title = label
  element.setAttribute("aria-label", label)
  element.addEventListener("click", (event) => {
    event.stopPropagation()
    onClick()
  })
  return element
}

export function MapCanvas({
  pins,
  selectedKey,
  onSelect,
  focus,
  userPosition,
  userPositionSeq,
}: {
  pins: MapPin[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  focus: FocusRequest | null
  userPosition: LatLng | null
  /** Muda a cada posição nova: a câmera vai até ela. */
  userPositionSeq: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)

  // O que os eventos do MapLibre leem — sempre a versão mais nova.
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const selectedRef = useRef(selectedKey)
  selectedRef.current = selectedKey

  const positionRef = useRef(userPosition)
  positionRef.current = userPosition

  const indexRef = useRef<Supercluster<{ key: string }> | null>(null)
  // Um objeto só, mutado no lugar: a limpeza sempre enxerga todos os marcadores.
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const hereRef = useRef<maplibregl.Marker | null>(null)

  /** Redesenha os pinos e grupos visíveis no zoom e na área de agora. */
  const renderMarkersRef = useRef(() => {})
  renderMarkersRef.current = () => {
    const map = mapRef.current
    const index = indexRef.current
    if (!map || !index) return

    const bounds = map.getBounds()
    const features = index.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(map.getZoom())
    )
    const byKey = new Map(pinsRef.current.map((pin) => [pin.key, pin]))
    const markers = markersRef.current
    const next = new Map<string, maplibregl.Marker>()

    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates
      const properties = feature.properties as Partial<ClusterProperties> & { key?: string }

      if (properties.cluster) {
        const id = properties.cluster_id!
        const markerKey = `grupo:${id}:${properties.point_count}`
        const existing = markers.get(markerKey)
        next.set(
          markerKey,
          existing ??
            new maplibregl.Marker({
              element: clusterElement(properties.point_count!, () => {
                const zoom = Math.min(index.getClusterExpansionZoom(id), 18)
                map.easeTo({ center: [lng, lat], zoom })
              }),
            })
              .setLngLat([lng, lat])
              .addTo(map)
        )
        continue
      }

      const pin = properties.key ? byKey.get(properties.key) : undefined
      if (!pin) continue
      const existing = markers.get(pin.key)
      const marker =
        existing ??
        new maplibregl.Marker({ element: pinElement(pin, (key) => onSelectRef.current(key)) })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
      marker.getElement().dataset.selected = String(pin.key === selectedRef.current)
      next.set(pin.key, marker)
    }

    for (const [markerKey, marker] of markers) {
      if (!next.has(markerKey)) {
        marker.remove()
        markers.delete(markerKey)
      }
    }
    for (const [markerKey, marker] of next) markers.set(markerKey, marker)
  }

  // O mapa nasce uma vez.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }),
      "bottom-right"
    )
    map.on("load", () => setReady(true))
    map.on("moveend", () => renderMarkersRef.current())
    map.on("click", () => onSelectRef.current(null))
    mapRef.current = map

    // Aba escondida e mostrada de novo: o mapa precisa saber o tamanho novo.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)

    const markers = markersRef.current
    return () => {
      observer.disconnect()
      removeAll(markers)
      hereRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Pinos novos (outro filtro): refaz o índice dos grupos e redesenha.
  const signature = pins.map((pin) => pin.key).join(",")
  useEffect(() => {
    const index = new Supercluster<{ key: string }>({ radius: 56, maxZoom: 16 })
    index.load(
      pinsRef.current.map(
        (pin): PinFeature => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
          properties: { key: pin.key },
        })
      )
    )
    indexRef.current = index
    removeAll(markersRef.current)
    if (ready) renderMarkersRef.current()
  }, [signature, ready])

  // Ao abrir e a cada filtro novo: enquadra os pinos visíveis.
  useEffect(() => {
    const map = mapRef.current
    const visible = pinsRef.current
    if (!map || !ready || visible.length === 0) return
    if (visible.length === 1) {
      map.jumpTo({ center: [visible[0].lng, visible[0].lat], zoom: 15 })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    for (const pin of visible) bounds.extend([pin.lng, pin.lat])
    map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 })
  }, [signature, ready])

  // O pino tocado fica em destaque.
  useEffect(() => {
    for (const [markerKey, marker] of markersRef.current) {
      if (!markerKey.startsWith("grupo:")) {
        marker.getElement().dataset.selected = String(markerKey === selectedKey)
      }
    }
  }, [selectedKey])

  // Tocar num item da lista (ou abrir com `?item=`): vai até o pino.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !focus) return
    const pin = pinsRef.current.find((item) => item.key === focus.key)
    if (!pin) return
    map.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 16) })
  }, [focus, ready])

  // "Minha localização": o ponto azul, e a câmera vai até ele.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!userPosition) {
      hereRef.current?.remove()
      hereRef.current = null
      return
    }
    if (!hereRef.current) {
      const element = document.createElement("span")
      element.className = HERE_CLASS
      element.title = "Você está aqui"
      hereRef.current = new maplibregl.Marker({ element }).setLngLat([userPosition.lng, userPosition.lat]).addTo(map)
    } else {
      hereRef.current.setLngLat([userPosition.lng, userPosition.lat])
    }
  }, [userPosition, ready])

  // Só quando chega uma posição NOVA (`seq`) — por isso ela vem do ref.
  useEffect(() => {
    const map = mapRef.current
    const position = positionRef.current
    if (!map || !ready || !position || userPositionSeq === 0) return
    map.easeTo({ center: [position.lng, position.lat], zoom: Math.max(map.getZoom(), 15) })
  }, [userPositionSeq, ready])

  return <div ref={containerRef} className="vitrine-map size-full" />
}
