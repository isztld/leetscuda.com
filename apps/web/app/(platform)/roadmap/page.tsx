import { prisma } from '@/lib/prisma'
import { RoadmapClient } from '@/components/RoadmapClient'

export const metadata = {
  title: 'Roadmap — LeetsCUDA',
  description: 'From CUDA fundamentals to production inference systems.',
}

export default async function RoadmapPage() {
  const tracks = await prisma.track.findMany({
    orderBy: { order: 'asc' },
    include: { roadmapNodes: { orderBy: { order: 'asc' } } },
  })

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Your AI Infrastructure Roadmap</h1>
          <p className="text-zinc-400 mt-3 text-lg">
            From CUDA fundamentals to production inference systems
          </p>
        </div>

        <RoadmapClient tracks={tracks} />
      </div>
    </main>
  )
}
