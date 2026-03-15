import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn — leetscuda.com',
  description: 'Theory content for CUDA, ML Systems, Kubernetes, and Foundations.',
}

export default async function LearnIndexPage() {
  const tracks = await prisma.track.findMany({
    orderBy: { order: 'asc' },
    include: {
      roadmapNodes: {
        where: { type: 'CONCEPT' },
        orderBy: { order: 'asc' },
      },
    },
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Learn</h1>
          <p className="text-slate-500 text-lg">
            Theory and concepts across all tracks. Read before you code.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {tracks.map((track) => {
            const concepts = track.roadmapNodes
            if (concepts.length === 0) return null
            const firstConcept = concepts[0]

            return (
              <div key={track.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Track header */}
                <div className="h-1" style={{ backgroundColor: track.color }} />
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{track.title}</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {concepts.length} concept{concepts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Link
                      href={`/learn/${firstConcept.slug}`}
                      className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: track.color }}
                    >
                      Start learning →
                    </Link>
                  </div>
                </div>

                {/* Concept list */}
                <ul className="divide-y divide-slate-100">
                  {concepts.map((node) => (
                    <li key={node.id}>
                      <Link
                        href={`/learn/${node.slug}`}
                        className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition-colors group"
                      >
                        <div
                          className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                          style={{ backgroundColor: track.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                            {node.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                            {node.description}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
