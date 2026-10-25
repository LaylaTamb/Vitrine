import { redirect } from "next/navigation"

import { profilePath } from "@/lib/domain/username"
import { getMyProfile, requireUser } from "@/lib/queries/session"

type SearchParams = Promise<{ item?: string; aba?: string; categoria?: string }>

/**
 * `/mapa` — agora é a aba Mapa do seu perfil. Os links "Ver no mapa"
 * (`?categoria=`, `?item=`) e a aba Sugestões (`?aba=sugestoes`) seguem junto.
 */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  await requireUser()
  const [profile, query] = await Promise.all([getMyProfile(), searchParams])
  if (!profile) redirect("/")
  const params = new URLSearchParams({ aba: "mapa" })
  if (query.aba === "sugestoes") params.set("mapa", "sugestoes")
  if (query.categoria) params.set("categoria", query.categoria)
  if (query.item) params.set("item", query.item)
  redirect(`${profilePath(profile.username)}?${params.toString()}`)
}
