import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto fiel ao layout de Coleções — não um spinner centralizado. */
export default function Loading() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell">
        <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>

        <Skeleton className="mb-5 h-5 w-24" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
