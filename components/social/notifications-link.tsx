import Link from "next/link"
import { Bell } from "lucide-react"

/**
 * O sininho da barra: leva aos Avisos (`/avisos`), com o número de não lidas
 * (que chega pronto do servidor). Abrir os Avisos marca tudo como lido.
 */
export function NotificationsLink({ count }: { count: number }) {
  const label = count > 0 ? `Avisos: ${count} ${count === 1 ? "novo" : "novos"}` : "Avisos"

  return (
    <Link
      href="/avisos"
      aria-label={label}
      title={label}
      className="relative rounded-full p-2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-dim"
    >
      <Bell className="size-5" />
      {count > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] leading-4 font-medium text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  )
}
