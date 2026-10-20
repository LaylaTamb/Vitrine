"use client"

import { MapPin, X } from "lucide-react"
import { useEffect, useState } from "react"

import { nearbyPlacesAction } from "@/app/mapa/actions"
import { PlaceSheet } from "@/components/nearby/place-sheet"
import type { LatLng } from "@/lib/domain/map"
import { nearbyCacheCenter, type NearbyPlace, type PlaceTarget } from "@/lib/domain/nearby"

const DISMISSED_KEY = "vitrine:aqui:fechado"
const CACHE_PREFIX = "vitrine:aqui:"
/** A mesma resposta vale meia hora nesta aba (não pergunta ao servidor de novo). */
const CACHE_MS = 30 * 60_000

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Aba privada ou armazenamento bloqueado: só não guarda.
  }
}

/**
 * A posição SEM perguntar nada: só se a pessoa já autorizou a localização
 * antes (num toque dela, no Mapa). Sem autorização — ou sem como saber —,
 * nada.
 */
async function silentPosition(): Promise<LatLng | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
    return null
  }
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName })
    if (status?.state !== "granted") return null
  } catch {
    return null
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (result) => resolve({ lat: result.coords.latitude, lng: result.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 120_000 }
    )
  })
}

/**
 * "Você está em X?" — em Coleções e no Mapa, até 3 lugares a ~150 m. A
 * posição é usada para a busca e some (nunca é gravada). Fechar esconde até
 * o fim da sessão.
 */
export function HereBanner({ targets }: { targets: PlaceTarget[] }) {
  const [found, setFound] = useState<{ position: LatLng; places: NearbyPlace[] } | null>(null)
  const [open, setOpen] = useState<NearbyPlace | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      if (readSession(DISMISSED_KEY)) return
      const position = await silentPosition()
      if (!alive || !position) return

      const center = nearbyCacheCenter(position)
      const key = `${CACHE_PREFIX}${center.lat},${center.lng}`
      try {
        const cached = JSON.parse(readSession(key) ?? "null") as {
          at: number
          places: NearbyPlace[]
        } | null
        if (cached && Date.now() - cached.at < CACHE_MS) {
          if (cached.places.length > 0) setFound({ position, places: cached.places })
          return
        }
      } catch {
        // Cache torto: pergunta de novo.
      }

      const result = await nearbyPlacesAction(position)
      if (!alive || !result.ok || !result.data) return
      writeSession(key, JSON.stringify({ at: Date.now(), places: result.data }))
      if (result.data.length > 0) setFound({ position, places: result.data })
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!found || hidden) return null

  function dismiss() {
    writeSession(DISMISSED_KEY, "1")
    setHidden(true)
  }

  return (
    <>
      <div
        role="region"
        aria-label="Lugares por perto"
        className="mt-6 flex items-start gap-2.5 rounded-lg border border-brand-dim bg-brand-wash px-3 py-2.5 text-sm"
      >
        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground">Você está em…</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {found.places.map((place) => (
              <button
                key={place.placeId}
                type="button"
                onClick={() => setOpen(place)}
                className="max-w-full truncate rounded-full border border-line bg-surface px-3 py-1 text-sm text-foreground transition-colors hover:border-brand-dim"
              >
                {place.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar por agora"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {open ? (
        <PlaceSheet
          place={open}
          position={found.position}
          targets={targets}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}
