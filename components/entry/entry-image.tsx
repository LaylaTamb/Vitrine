import { cn } from "@/lib/utils"

/**
 * A imagem de um item, com a luz de vitrine atrás — o brilho roxo desfocado
 * que vaza pelas bordas. É a assinatura visual do app.
 *
 * `<img>` nativa de propósito: as URLs são externas e arbitrárias, e liberar
 * `remotePatterns: "**"` no next/image transformaria o otimizador num proxy
 * aberto.
 */
export function EntryImage({
  imageUrl,
  imagePosition,
  imageTransform,
  initial,
  ratio = "3 / 4",
  className,
  initialSize = "3.5rem",
  eager = false,
}: {
  imageUrl: string | null
  imagePosition: string
  imageTransform: string
  initial: string
  ratio?: string
  className?: string
  initialSize?: string
  eager?: boolean
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="showcase-glow" />
      <div
        className="relative z-[1] overflow-hidden rounded-md border border-line bg-bg-soft"
        style={{ aspectRatio: ratio }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- proposital: URL externa arbitrária, sem otimizador
          <img
            src={imageUrl}
            alt=""
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover"
            style={{ objectPosition: imagePosition, transform: imageTransform }}
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
