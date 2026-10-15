"use client"

import { useCallback, useState } from "react"

import { geolocationErrorMessage, type LatLng } from "@/lib/domain/map"

export type LocateResult = { ok: true; position: LatLng } | { ok: false; error: string }

/**
 * "Onde estou", só em memória: a posição nunca vai para o banco nem para a
 * URL. Vem do aparelho ("Minha localização", só em HTTPS ou localhost — a
 * Vercel já atende) ou de um endereço digitado nas Sugestões.
 *
 * `seq` muda a cada posição nova — é o sinal para a câmera ir até ela.
 */
export function useGeolocation() {
  const [position, setPositionState] = useState<LatLng | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [seq, setSeq] = useState(0)

  /** Uma posição de outro lugar (o endereço digitado), com o nome dela. */
  const setPosition = useCallback((next: LatLng | null, nextLabel: string | null = null) => {
    setPositionState(next)
    setLabel(next ? nextLabel : null)
    if (next) setSeq((value) => value + 1)
  }, [])

  const locate = useCallback((): Promise<LocateResult> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve({ ok: false, error: "Este navegador não informa a localização." })
    }
    if (!window.isSecureContext) {
      return Promise.resolve({
        ok: false,
        error: "A localização só funciona com o site em HTTPS.",
      })
    }

    setLocating(true)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const next = { lat: result.coords.latitude, lng: result.coords.longitude }
          setLocating(false)
          setPosition(next, "sua localização atual")
          resolve({ ok: true, position: next })
        },
        (error) => {
          setLocating(false)
          resolve({ ok: false, error: geolocationErrorMessage(error.code) })
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
      )
    })
  }, [setPosition])

  return { position, label, locating, seq, locate, setPosition }
}
