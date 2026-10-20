import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <SkeletonGrid count={6} className="sm:grid-cols-2 lg:grid-cols-2" itemClassName="h-14" />
    </PageSkeleton>
  )
}
