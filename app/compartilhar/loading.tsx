import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell">
        <div className="mx-auto max-w-md space-y-3 py-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
