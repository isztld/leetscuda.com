import { Skeleton } from '@/components/Skeleton'

export default function ProblemDetailLoading() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel skeleton (40%) */}
        <div className="w-2/5 flex flex-col bg-white border-r border-slate-200 min-h-0">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 shrink-0">
            <Skeleton variant="line" className="h-6 w-3/4 mb-3" />
            <div className="flex items-center gap-2">
              <Skeleton variant="badge" className="w-16 h-5 rounded-full" />
              <Skeleton variant="badge" className="w-28 h-5 rounded-full" />
              <Skeleton variant="badge" className="w-16 h-5 ml-auto" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 shrink-0 px-4 py-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="badge" className="h-4 w-20" />
            ))}
          </div>

          {/* Description block */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-5/6" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-4/5" />
            <Skeleton variant="block" className="h-20 mt-4" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-3/4" />
          </div>
        </div>

        {/* Right panel skeleton (60%) */}
        <div className="w-3/5 flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
            <Skeleton variant="badge" className="h-7 w-24" />
            <Skeleton variant="badge" className="h-7 w-20" />
          </div>

          {/* Editor area skeleton */}
          <div className="flex-1 bg-[#1e1e1e] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
