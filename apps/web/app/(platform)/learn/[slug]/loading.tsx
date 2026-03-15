import { Skeleton } from '@/components/Skeleton'

export default function LearnLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Left sidebar skeleton */}
          <aside className="hidden lg:flex flex-col w-48 shrink-0 gap-2">
            <Skeleton variant="line" className="h-3 w-24 mb-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="line" className="h-6 w-full" />
            ))}
          </aside>

          {/* Content skeleton */}
          <main className="flex-1 min-w-0 max-w-2xl">
            <Skeleton variant="line" className="h-9 w-2/3 mb-4" />
            <div className="flex gap-2 mb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="badge" className="h-5 w-16" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="line" className="h-4 w-full" />
              ))}
              <Skeleton variant="block" className="h-32 mt-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="line" className="h-4 w-5/6" />
              ))}
            </div>
          </main>

          {/* ToC skeleton */}
          <aside className="hidden xl:block w-48 shrink-0 gap-2 flex-col">
            <Skeleton variant="line" className="h-3 w-20 mb-3" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="line" className="h-3 w-full" />
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}
