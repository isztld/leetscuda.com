import { prisma } from '@/lib/prisma'
import { RoadmapClient } from '@/components/RoadmapClient'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata = {
  title: 'Roadmap — leetscuda.com',
  description:
    'Master CUDA, ML systems, and Kubernetes for AI. The interview prep platform for AI infrastructure engineers.',
}

export default async function RoadmapPage() {
  const tracks = await prisma.track.findMany({
    orderBy: { order: 'asc' },
    include: { roadmapNodes: { orderBy: { order: 'asc' } } },
  })

  return (
    <main className="min-h-screen">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Your AI Infrastructure Roadmap
          </h1>
          <p className="text-slate-600 mt-3 text-lg">
            From CUDA fundamentals to production inference systems
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ErrorBoundary
          fallback={
            <p className="text-slate-500 text-sm">Failed to load roadmap. Please refresh.</p>
          }
        >
          <RoadmapClient tracks={tracks} />
        </ErrorBoundary>
      </div>
    </main>
  )
}
