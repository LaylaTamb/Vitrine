import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Skeleton className="h-72 rounded-xl" />
        <SkeletonGrid count={6} className="lg:grid-cols-3" itemClassName="aspect-[3/4]" />
      </div>
    </PageSkeleton>
  )
}
