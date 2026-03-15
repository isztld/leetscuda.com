import { Skeleton } from '@/components/Skeleton'

export default function RoadmapLoading() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <Skeleton variant="line" className="h-10 w-80 mb-3" />
          <Skeleton variant="line" className="h-5 w-96" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="animate-pulse h-1 w-full rounded-t mb-4 bg-zinc-700" />
              <Skeleton variant="line" className="h-5 w-3/4 mb-2" />
              <Skeleton variant="line" className="h-3 w-1/2 mb-5" />
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} variant="block" className="mb-2 h-16 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
