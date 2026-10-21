"use client"

import { useState } from "react"

import type { CardBanner } from "@/lib/domain/card"
import { cn } from "@/lib/utils"

/**
 * A faixa do topo do cartão (migração 36), na proporção do Twitter (3:1). A
 * imagem vem pelo link, como a foto e as imagens dos itens; `position`
 * escolhe que parte dela aparece (0 = topo, 100 = pé). Sem banner — ou com
 * um link que não carrega —, a faixa fica na cor da casa.
 *
 * `<img>` nativa de propósito: URL externa arbitrária, sem o otimizador do Next.
 */
export function ProfileBanner({
  banner,
  className,
}: {
  banner: CardBanner | null
  className?: string
}) {
  // O link que falhou (e não "falhou ou não"): trocar o link tenta de novo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = banner !== null && banner.url !== failedUrl

  return (
    <div
      className={cn(
        "relative aspect-[3/1] max-h-60 w-full overflow-hidden bg-linear-to-br from-brand-wash via-surface-hi to-surface",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- proposital: URL externa arbitrária, sem otimizador
        <img
          src={banner.url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(banner.url)}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: `center ${banner.position}%` }}
        />
      ) : null}
    </div>
  )
}
