import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={0}>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-48" />
      </div>
      <SkeletonGrid
        count={6}
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        itemClassName="h-56"
      />
    </PageSkeleton>
  )
}
