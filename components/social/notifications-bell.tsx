import { NotificationsMenu } from "@/components/social/notifications-menu"
import { getSessionUser } from "@/lib/queries/session"
import { getUnreadCount } from "@/lib/queries/social"

/**
 * O número do sininho, lido no servidor. A barra envolve isto num
 * `Suspense`: a página não espera a contagem — ela chega logo depois, no
 * mesmo HTML em streaming (nada de `useEffect` buscando na primeira pintura).
 */
export async function NotificationsBell() {
  const user = await getSessionUser()
  if (!user) return null
  const count = await getUnreadCount(user.id)
  return <NotificationsMenu initialCount={count} />
}
