import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-dvh md:pl-20 lg:pl-64">
      <div className="h-14 border-b border-line md:hidden" />
      <div className="fixed inset-y-0 left-0 hidden w-20 border-r border-line md:block lg:w-64" />
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
