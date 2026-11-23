import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { MapSample } from "@/components/guest/guest-samples"
import { AppShell } from "@/components/layout/app-shell"

import { profilePath } from "@/lib/domain/username"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"

type SearchParams = Promise<{ item?: string; aba?: string; categoria?: string }>

export const metadata: Metadata = { title: "Mapa · Vitrine" }

/**
 * `/mapa` — agora é a aba Mapa do seu perfil. Os links "Ver no mapa"
 * (`?categoria=`, `?item=`) e a aba Sugestões (`?aba=sugestoes`) seguem junto.
 * Sem conta (modo visitante), a amostra: o mapa das listas, com um exemplo.
 */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) {
    return (
      <AppShell profile={null} visitor={{ next: "/mapa" }}>
        <MapSample />
      </AppShell>
    )
  }
  const [profile, query] = await Promise.all([getMyProfile(), searchParams])
  if (!profile) redirect("/")
  const params = new URLSearchParams({ aba: "mapa" })
  if (query.aba === "sugestoes") params.set("mapa", "sugestoes")
  if (query.categoria) params.set("categoria", query.categoria)
  if (query.item) params.set("item", query.item)
  redirect(`${profilePath(profile.username)}?${params.toString()}`)
}
