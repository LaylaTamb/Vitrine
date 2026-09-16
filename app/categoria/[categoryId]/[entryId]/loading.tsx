import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell grid gap-8 py-8 md:grid-cols-[2fr_3fr]">
        <Skeleton className="aspect-[3/4] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
