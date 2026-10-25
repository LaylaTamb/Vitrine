import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto fiel ao Início (as bolinhas e os cartões do feed) — não um spinner. */
export default function Loading() {
  return (
    <div className="min-h-dvh md:pl-20 lg:pl-64">
      <div className="h-14 border-b border-line md:hidden" />
      <div className="fixed inset-y-0 left-0 hidden w-20 border-r border-line md:block lg:w-64" />
      <div className="shell">
        <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <div className="flex gap-3 overflow-hidden py-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="size-14 shrink-0 rounded-full" />
              ))}
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="hidden h-64 rounded-2xl lg:block" />
        </div>
      </div>
    </div>
  )
}
