import { PageSkeleton } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={0}>
      <div className="mb-5 flex gap-2 border-b border-line pb-2">
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Skeleton className="hidden h-72 rounded-xl lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-28 rounded-lg lg:hidden" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <Skeleton className="h-[calc(100dvh-15rem)] min-h-80 rounded-xl lg:h-[36rem]" />
            <Skeleton className="h-48 rounded-xl xl:h-[36rem]" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  )
}
