import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** A casca comum dos `loading.tsx`: navbar + cabeçalho de plaqueta. */
export function PageSkeleton({
  children,
  actions = 2,
}: {
  children?: React.ReactNode
  actions?: number
}) {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell">
        <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: actions }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-28" />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SkeletonGrid({
  count = 8,
  className,
  itemClassName = "h-28",
}: {
  count?: number
  className?: string
  itemClassName?: string
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={cn("rounded-lg", itemClassName)} />
      ))}
    </div>
  )
}
