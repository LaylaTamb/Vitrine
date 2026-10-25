import { PageSkeleton } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={0}>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </PageSkeleton>
  )
}
