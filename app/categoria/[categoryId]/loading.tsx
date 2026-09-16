import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto fiel à página de categoria: cabeçalho, abas, filtros e grade. */
export default function Loading() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b border-line" />
      <div className="shell">
        <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <div className="mb-5 flex gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-28 rounded-full" />
          ))}
        </div>

        <Skeleton className="mb-5 h-9 w-full" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
