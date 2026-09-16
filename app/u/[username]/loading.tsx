import { PageSkeleton, SkeletonGrid } from "@/components/layout/page-skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <SkeletonGrid />
    </PageSkeleton>
  )
}
