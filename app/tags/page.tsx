import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { TagsView } from "@/components/tag/tags-view"
import { getMyProfile, requireUser } from "@/lib/queries/session"
import { getTagsWithUsage } from "@/lib/queries/tags"

export const metadata: Metadata = { title: "Tags · Vitrine" }

/** `/tags` — o vocabulário compartilhado do grupo. */
export default async function TagsPage() {
  await requireUser()
  const [tags, profile] = await Promise.all([getTagsWithUsage(), getMyProfile()])

  return (
    <AppShell profile={profile}>
      <TagsView tags={tags} />
    </AppShell>
  )
}
