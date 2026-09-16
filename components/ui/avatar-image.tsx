import { cn } from "@/lib/utils"

/**
 * Avatar: a foto quando existe, a inicial em roxo quando não.
 *
 * `<img>` nativa de propósito — as URLs são externas e arbitrárias, e liberar
 * `remotePatterns: "**"` transformaria o otimizador do Next num proxy aberto.
 */
export function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase()

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-hi",
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- proposital: URL externa arbitrária, sem otimizador
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <span
          className="display text-brand"
          style={{ fontSize: Math.max(12, Math.round(size * 0.45)) }}
        >
          {initial}
        </span>
      )}
    </span>
  )
}
