import { redirect } from "next/navigation"

import { profilePath } from "@/lib/domain/username"
import { getMyProfile, requireUser } from "@/lib/queries/session"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * `/` — o app abre no seu perfil, nas Coleções. O endereço leva o resto junto
 * (o link antigo das Coleções, `/?pasta=…`, abre a pasta certa). O feed de quem
 * você segue é o Início (`/inicio`). Sem perfil (conta incompleta), o Início.
 */
export default async function RootPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser()
  const [profile, query] = await Promise.all([getMyProfile(), searchParams])
  if (!profile) redirect("/inicio")

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value)
  }
  const search = params.toString()
  redirect(`${profilePath(profile.username)}${search ? `?${search}` : ""}`)
}
