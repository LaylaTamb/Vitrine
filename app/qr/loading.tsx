import { PageSkeleton } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton actions={0}>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="aspect-square w-full rounded-2xl" />
      </div>
    </PageSkeleton>
  )
}
