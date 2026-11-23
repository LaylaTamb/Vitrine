import { getSessionUser } from "@/lib/queries/session"
import { getUnreadCount } from "@/lib/queries/social"

/**
 * O número de avisos não lidos, como selo no ícone dos Avisos (barra lateral e
 * abas de baixo), lido no servidor. A barra envolve isto num `Suspense`: a
 * página não espera a contagem — ela chega logo depois, no mesmo HTML em
 * streaming (nada de `useEffect` buscando na primeira pintura).
 */
export async function UnreadBadge() {
  const user = await getSessionUser()
  if (!user) return null
  const count = await getUnreadCount(user.id)
  if (count === 0) return null
  return (
    <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] leading-4 font-medium text-primary-foreground">
      <span className="sr-only">, </span>
      {count > 9 ? "9+" : count}
      <span className="sr-only"> {count === 1 ? "novo" : "novos"}</span>
    </span>
  )
}
