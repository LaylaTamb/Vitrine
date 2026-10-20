import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <SkeletonGrid count={4} itemClassName="h-64" />
    </PageSkeleton>
  )
}
