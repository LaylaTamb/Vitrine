import { redirect } from "next/navigation"

import { profilePath } from "@/lib/domain/username"
import { getMyProfile, requireUser } from "@/lib/queries/session"

/** `/filtro` — o Filtro geral agora é o botão Filtros das Coleções, no seu perfil. */
export default async function Page() {
  await requireUser()
  const profile = await getMyProfile()
  redirect(profile ? `${profilePath(profile.username)}?filtros=1` : "/")
}
