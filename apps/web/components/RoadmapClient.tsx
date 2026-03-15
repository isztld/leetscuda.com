'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import type { Track, RoadmapNode } from '@prisma/client'

type TrackWithNodes = Track & { roadmapNodes: RoadmapNode[] }

export function RoadmapClient({ tracks }: { tracks: TrackWithNodes[] }) {
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'

  const { data: completedSlugsArray } = trpc.roadmap.getUserProgress.useQuery(undefined, {
    enabled: isAuthenticated,
  })

  const completedSlugs = new Set(completedSlugsArray ?? [])

  function isNodeUnlocked(node: RoadmapNode): boolean {
    // Unauthenticated visitors see everything unlocked (public preview)
    if (!isAuthenticated) return true
    return node.prerequisites.every((slug) => completedSlugs.has(slug))
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {tracks.map((track) => {
        const completedCount = track.roadmapNodes.filter((n) => completedSlugs.has(n.slug)).length
        const total = track.roadmapNodes.length
        const progressPct = total > 0 ? (completedCount / total) * 100 : 0

        return (
          <div key={track.id} className="flex flex-col">
            {/* Colored top border */}
            <div className="h-1 w-full rounded-t mb-4" style={{ backgroundColor: track.color }} />

            {/* Track title */}
            <h2 className="text-base font-semibold mb-2 leading-tight">{track.title}</h2>

            {/* Progress bar */}
            <div className="mb-5">
              <p className="text-xs text-zinc-500 mb-1.5">
                {completedCount} / {total} completed
              </p>
              <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: track.color }}
                />
              </div>
            </div>

            {/* Node list */}
            <div className="flex flex-col gap-2">
              {track.roadmapNodes.map((node) => {
                const isCompleted = completedSlugs.has(node.slug)
                const unlocked = isNodeUnlocked(node)
                const isInteractive = unlocked && !isCompleted
                const href =
                  node.type === 'PROBLEM' ? `/problems/${node.slug}` : `/learn/${node.slug}`

                const card = (
                  <div
                    className={[
                      'relative rounded-lg border p-3 text-sm transition-colors',
                      isCompleted
                        ? 'border-zinc-700 bg-zinc-900'
                        : unlocked
                          ? 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                          : 'border-zinc-800 bg-zinc-900/40 opacity-50',
                    ].join(' ')}
                  >
                    {/* Completed tint overlay */}
                    {isCompleted && (
                      <div
                        className="absolute inset-0 rounded-lg pointer-events-none opacity-[0.07]"
                        style={{ backgroundColor: track.color }}
                      />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-snug">{node.title}</span>
                      <span className="shrink-0 mt-0.5">
                        {isCompleted ? (
                          <CheckIcon color={track.color} />
                        ) : !unlocked ? (
                          <LockIcon />
                        ) : null}
                      </span>
                    </div>

                    <span
                      className={[
                        'inline-block mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide',
                        node.type === 'PROBLEM'
                          ? 'bg-blue-950 text-blue-300'
                          : 'bg-violet-950 text-violet-300',
                      ].join(' ')}
                    >
                      {node.type}
                    </span>
                  </div>
                )

                if (isInteractive) {
                  return (
                    <Link key={node.id} href={href} className="block">
                      {card}
                    </Link>
                  )
                }

                return <div key={node.id}>{card}</div>
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.2" />
      <path
        d="M4.5 8.5l2.5 2.5 4.5-5.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="text-zinc-600"
      aria-hidden="true"
    >
      <rect x="2" y="6.5" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 6.5V4.5a2.5 2.5 0 015 0v2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
