import type { Metadata } from "next"

import { FollowListPage } from "@/components/social/follow-list-page"

type Params = Promise<{ username: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  return { title: `Quem @${username} segue · Vitrine` }
}

/** `/v/[username]/seguindo` — quem a pessoa segue. */
export default async function FollowingPage({ params }: { params: Params }) {
  const { username } = await params
  return <FollowListPage rawUsername={username} kind="seguindo" />
}
