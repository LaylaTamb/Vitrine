import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <Skeleton className="mb-10 h-12 w-full" />
      <Skeleton className="mb-3 h-7 w-56" />
      <div className="mb-10 flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-48 w-40 shrink-0 rounded-2xl" />
        ))}
      </div>
      <SkeletonGrid
        count={6}
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        itemClassName="h-72"
      />
    </PageSkeleton>
  )
}
