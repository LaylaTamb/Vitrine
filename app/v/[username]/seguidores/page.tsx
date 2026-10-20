import type { Metadata } from "next"

import { FollowListPage } from "@/components/social/follow-list-page"

type Params = Promise<{ username: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  return { title: `Seguidores de @${username} · Vitrine` }
}

/** `/v/[username]/seguidores` — quem segue a pessoa. */
export default async function FollowersPage({ params }: { params: Params }) {
  const { username } = await params
  return <FollowListPage rawUsername={username} kind="seguidores" />
}
