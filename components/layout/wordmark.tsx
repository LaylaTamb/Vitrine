import { cn } from "@/lib/utils"

/**
 * "Vitrine" em Fraunces itálico, com o ponto roxo luminoso à esquerda.
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string
  size?: "md" | "lg"
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="size-2 rounded-full bg-brand"
        style={{ boxShadow: "0 0 10px 1px var(--brand-glow)" }}
      />
      <span
        className={cn(
          "display leading-none text-foreground",
          size === "lg" ? "text-3xl" : "text-xl"
        )}
      >
        Vitrine
      </span>
    </span>
  )
}
