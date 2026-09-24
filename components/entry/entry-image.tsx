"use client"

import { useEffect, useRef, useState } from "react"

import { categoryTintVars, cn } from "@/lib/utils"

/**
 * A imagem de um item, com a luz de vitrine atrás — o brilho roxo desfocado
 * que vaza pelas bordas (ou a cor da categoria, via `tint`). É a assinatura
 * visual do app.
 *
 * `<img>` nativa de propósito: as URLs são externas e arbitrárias, e liberar
 * `remotePatterns: "**"` no next/image transformaria o otimizador num proxy
 * aberto.
 *
 * Link morto ou bloqueado por hotlink cai no mesmo visual de "sem imagem"
 * (a inicial) em vez do ícone de imagem quebrada do navegador.
 */
export function EntryImage({
  imageUrl,
  imageTransform,
  initial,
  ratio = "3 / 4",
  className,
  initialSize = "3.5rem",
  eager = false,
  tint,
}: {
  imageUrl: string | null
  imageTransform: string
  initial: string
  ratio?: string
  className?: string
  initialSize?: string
  eager?: boolean
  /** Cor da categoria do item, se houver — só usada quando não há um `.vitrine-card` por fora já tingido. */
  tint?: string | null
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    // O evento `error` de <img> não borbulha e pode disparar antes da
    // hidratação prender o listener (link que falha na hora, tipo DNS
    // inexistente) — sem isso, o erro passa batido e a imagem quebrada do
    // navegador fica ali pra sempre. Checa o estado real após montar.
    if (imgRef.current?.complete && imgRef.current.naturalWidth === 0) {
      setFailed(true)
    }
  }, [imageUrl])

  return (
    <div className={cn("relative", className)} style={categoryTintVars(tint)}>
      <span className="showcase-glow" />
      <div
        className="relative z-[1] overflow-hidden rounded-md border border-line bg-bg-soft"
        style={{ aspectRatio: ratio }}
      >
        {imageUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- proposital: URL externa arbitrária, sem otimizador
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover"
            style={{ transform: imageTransform }}
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            aria-hidden
            className="display flex size-full items-center justify-center text-faint"
            style={{ fontSize: initialSize }}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  )
}
