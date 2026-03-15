import { Skeleton } from '@/components/Skeleton'

export default function ProblemsLoading() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <Skeleton variant="line" className="h-10 w-40 mb-3" />
          <Skeleton variant="line" className="h-5 w-72" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="badge" className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Table skeleton — 8 rows */}
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/50 px-4 py-3 border-b border-zinc-800">
            <Skeleton variant="line" className="h-3 w-48" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 border-b border-zinc-800 last:border-0"
            >
              <Skeleton variant="badge" className="w-5 h-5 rounded-full shrink-0" />
              <Skeleton variant="line" className="flex-1 h-4" />
              <Skeleton variant="badge" className="w-16 h-5 hidden sm:block" />
              <Skeleton variant="badge" className="w-24 h-4 hidden md:block" />
              <Skeleton variant="badge" className="w-12 h-4 text-right" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
