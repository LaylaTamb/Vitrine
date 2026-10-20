import { SkeletonGrid } from "@/components/layout/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** O cartão no topo e, embaixo, o cabeçalho e a grade das coleções. */
export default function Loading() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell">
        <div className="pt-6">
          <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-56" />
          </div>
        </div>
        <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <SkeletonGrid />
      </div>
    </div>
  )
}
