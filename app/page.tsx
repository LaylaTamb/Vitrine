import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Welcome } from "@/components/guest/welcome"
import { profilePath } from "@/lib/domain/username"
import { getExplore } from "@/lib/queries/explore"
import { getPublicCovers } from "@/lib/queries/public"
import { getMyProfile, getSessionUser } from "@/lib/queries/session"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Quantas listas Públicas de exemplo as boas-vindas mostram. */
const EXAMPLES = 4

export const metadata: Metadata = {
  title: "Vitrine · a sua rede de gostos",
  description:
    "Catalogue restaurantes, filmes, livros, jogos e viagens do seu jeito, e mostre para quem quiser.",
}

/**
 * `/` — com conta, o app abre no seu perfil, nas Coleções. O endereço leva o
 * resto junto (o link antigo das Coleções, `/?pasta=…`, abre a pasta certa).
 * O feed de quem você segue é o Início (`/inicio`). Sem perfil (conta
 * incompleta), o Início.
 *
 * Sem conta, as boas-vindas do modo visitante: o que é o Vitrine e as listas
 * Públicas mais copiadas como exemplo (sem a migração 50, sem exemplos).
 */
export default async function RootPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) {
    const explore = await getExplore(EXAMPLES)
    const examples = explore.results.slice(0, EXAMPLES)
    const covers = await getPublicCovers(examples.map((category) => category.id))
    return <Welcome examples={examples} covers={covers} />
  }

  const [profile, query] = await Promise.all([getMyProfile(), searchParams])
  if (!profile) redirect("/inicio")

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value)
  }
  const search = params.toString()
  redirect(`${profilePath(profile.username)}${search ? `?${search}` : ""}`)
}
