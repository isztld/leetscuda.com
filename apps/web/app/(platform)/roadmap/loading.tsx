import { Skeleton } from '@/components/Skeleton'

export default function RoadmapLoading() {
  return (
    <main className="min-h-screen">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton variant="line" className="h-10 w-80 mb-3" />
          <Skeleton variant="line" className="h-5 w-96" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="animate-pulse h-1 w-full rounded-t bg-slate-300" />
              <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg p-4">
                <Skeleton variant="line" className="h-5 w-3/4 mb-2" />
                <Skeleton variant="line" className="h-3 w-1/2 mb-5" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} variant="block" className="mb-2 h-16 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
