import { Skeleton } from '@/components/Skeleton'

export default function ProblemsLoading() {
  return (
    <main className="min-h-screen">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton variant="line" className="h-10 w-40 mb-3" />
          <Skeleton variant="line" className="h-5 w-72" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter bar skeleton */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="badge" className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Table skeleton — 8 rows */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <Skeleton variant="line" className="h-3 w-48" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0"
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
