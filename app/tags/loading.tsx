import { PageSkeleton } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={1}>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-lg" />
        ))}
      </div>
    </PageSkeleton>
  )
}
