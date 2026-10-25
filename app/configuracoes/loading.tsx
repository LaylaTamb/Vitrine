import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-dvh md:pl-20 lg:pl-64">
      <div className="h-14 border-b border-line md:hidden" />
      <div className="fixed inset-y-0 left-0 hidden w-20 border-r border-line md:block lg:w-64" />
      <div className="shell">
        <div className="mx-auto max-w-2xl space-y-7 py-7">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          {[3, 1, 4].map((rows, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="w-full rounded-2xl" style={{ height: rows * 52 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
