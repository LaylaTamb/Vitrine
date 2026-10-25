import { redirect } from "next/navigation"

import { profilePath } from "@/lib/domain/username"
import { getMyProfile, requireUser } from "@/lib/queries/session"

/** `/favoritos` — agora é a aba Favoritas do seu perfil. */
export default async function Page() {
  await requireUser()
  const profile = await getMyProfile()
  redirect(profile ? `${profilePath(profile.username)}?aba=favoritas` : "/")
}
