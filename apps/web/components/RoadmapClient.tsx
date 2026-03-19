'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import type { Track, RoadmapNode } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtendedTrack = Track & {
  shortTitle?: string | null
  difficulty?: string | null
  estimatedHours?: number | null
  prerequisites?: string[]
  previewNodes?: number | null
}

type TrackWithNodes = ExtendedTrack & { roadmapNodes: RoadmapNode[] }

const LS_KEY = 'roadmap-expanded-tracks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCluster(nodes: RoadmapNode[]): { cluster: string; nodes: RoadmapNode[] }[] {
  const map = new Map<string, RoadmapNode[]>()
  for (const node of nodes) {
    const key = node.cluster ?? 'general'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(node)
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => Math.min(...a.map((n) => n.order)) - Math.min(...b.map((n) => n.order)))
    .map(([cluster, nodes]) => ({ cluster, nodes }))
}

function nodeHref(node: RoadmapNode): string {
  return node.type === 'PROBLEM' ? `/problems/${node.slug}` : `/learn/${node.slug}`
}

function difficultyBorder(diff: string | null | undefined): string {
  if (!diff) return 'border-l-slate-200'
  if (diff === 'easy') return 'border-l-green-400'
  if (diff === 'intermediate' || diff === 'medium') return 'border-l-yellow-400'
  return 'border-l-red-400'
}

function typeBadgeClass(type: string): string {
  if (type === 'PROBLEM') return 'bg-amber-50 text-amber-700'
  if (type === 'ARTICLE') return 'bg-slate-100 text-slate-600'
  return 'bg-blue-50 text-blue-700'
}

function formatCluster(cluster: string): string {
  return cluster.replace(/-/g, ' ').toUpperCase()
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RoadmapClient({
  tracks,
  defaultExpandedTrack,
}: {
  tracks: TrackWithNodes[]
  defaultExpandedTrack: string
}) {
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'

  const { data: completedSlugsArray } = trpc.roadmap.getUserProgress.useQuery(undefined, {
    enabled: isAuthenticated,
  })

  const completedSlugs = new Set(completedSlugsArray ?? [])

  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(
    () => new Set([defaultExpandedTrack]),
  )
  const [hydrated, setHydrated] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        setExpandedTracks(new Set(parsed))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Auto-expand tracks where user has progress
  useEffect(() => {
    if (!isAuthenticated || !completedSlugsArray || !hydrated) return
    setExpandedTracks((prev) => {
      const next = new Set(prev)
      let anyProgress = false
      for (const track of tracks) {
        if (track.roadmapNodes.some((n) => completedSlugs.has(n.slug))) {
          next.add(track.slug)
          anyProgress = true
        }
      }
      if (!anyProgress && tracks.length > 0) {
        next.add(tracks[0].slug)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, completedSlugsArray, hydrated])

  const toggle = useCallback((slug: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      try {
        localStorage.setItem(LS_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {tracks.map((track, i) => (
        <TrackSection
          key={track.id}
          track={track}
          isExpanded={expandedTracks.has(track.slug)}
          onToggle={() => toggle(track.slug)}
          completedSlugs={completedSlugs}
          isAuthenticated={isAuthenticated}
          isFirst={i === 0}
        />
      ))}
    </div>
  )
}

// ── Track Section ─────────────────────────────────────────────────────────────

function TrackSection({
  track,
  isExpanded,
  onToggle,
  completedSlugs,
  isAuthenticated,
  isFirst,
}: {
  track: TrackWithNodes
  isExpanded: boolean
  onToggle: () => void
  completedSlugs: Set<string>
  isAuthenticated: boolean
  isFirst: boolean
}) {
  const total = track.roadmapNodes.length
  const completed = track.roadmapNodes.filter((n) => completedSlugs.has(n.slug)).length
  const progressPct = total > 0 ? (completed / total) * 100 : 0
  const previewCount = track.previewNodes ?? 3
  const previewNodes = track.roadmapNodes.slice(0, previewCount)
  const remainingCount = total - previewCount

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      {/* Colored top bar */}
      <div className="h-1" style={{ backgroundColor: track.color }} />

      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="mt-0.5 text-slate-400 transition-transform" style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 leading-tight">{track.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{total} nodes</span>
              {track.estimatedHours && (
                <>
                  <span>·</span>
                  <span>{track.estimatedHours}h</span>
                </>
              )}
              {track.difficulty && (
                <>
                  <span>·</span>
                  <span className="capitalize">{track.difficulty}</span>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{track.description}</p>

          {/* Progress bar — authenticated only */}
          {isAuthenticated && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: track.color }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {completed}/{total}
                </span>
              </div>
            </div>
          )}

          {/* Preview pills — collapsed only */}
          {!isExpanded && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {previewNodes.map((node) => (
                <span
                  key={node.slug}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                  style={{
                    backgroundColor: `${track.color}18`,
                    borderColor: `${track.color}30`,
                    color: track.color,
                  }}
                >
                  <NodeTypeIcon type={node.type} size={10} />
                  {truncate(node.title, 22)}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="text-[11px] text-slate-400">+{remainingCount} more ↓</span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          <ExpandedTrack
            track={track}
            completedSlugs={completedSlugs}
            isAuthenticated={isAuthenticated}
            isFirst={isFirst}
          />
        </div>
      )}
    </div>
  )
}

// ── Expanded Track ────────────────────────────────────────────────────────────

function ExpandedTrack({
  track,
  completedSlugs,
  isAuthenticated,
  isFirst,
}: {
  track: TrackWithNodes
  completedSlugs: Set<string>
  isAuthenticated: boolean
  isFirst: boolean
}) {
  const clusters = groupByCluster(track.roadmapNodes)

  return (
    <div className="px-5 py-4 flex flex-col gap-5">
      {clusters.map(({ cluster, nodes }) => (
        <ClusterSection
          key={cluster}
          cluster={cluster}
          nodes={nodes}
          completedSlugs={completedSlugs}
          isAuthenticated={isAuthenticated}
          trackColor={track.color}
        />
      ))}

      {!isAuthenticated && isFirst && (
        <p className="text-xs text-slate-400 text-center pt-1">
          Sign in to track progress
        </p>
      )}
    </div>
  )
}

// ── Cluster Section ───────────────────────────────────────────────────────────

function ClusterSection({
  cluster,
  nodes,
  completedSlugs,
  isAuthenticated,
  trackColor,
}: {
  cluster: string
  nodes: RoadmapNode[]
  completedSlugs: Set<string>
  isAuthenticated: boolean
  trackColor: string
}) {
  const completed = nodes.filter((n) => completedSlugs.has(n.slug)).length
  const total = nodes.length

  return (
    <div>
      {/* Cluster header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold tracking-widest text-slate-400">
          {formatCluster(cluster)}
        </span>
        <span className="text-[10px] text-slate-300">·</span>
        <span className="text-[10px] text-slate-400">{total} nodes</span>
        {isAuthenticated && (
          <>
            <span className="text-[10px] text-slate-300">·</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                    backgroundColor: trackColor,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {completed}/{total}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Node list with connectors */}
      <div className="flex flex-col">
        {nodes.map((node, idx) => {
          const isCompleted = completedSlugs.has(node.slug)
          const isLast = idx === nodes.length - 1

          return (
            <div key={node.slug}>
              <NodeCard
                node={node}
                isCompleted={isCompleted}
                isAuthenticated={isAuthenticated}
                completedSlugs={completedSlugs}
                trackColor={trackColor}
              />
              {!isLast && (
                <div className="flex justify-start ml-6 my-0.5">
                  <div className="w-px h-4 bg-slate-200" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Node Card ─────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  isCompleted,
  isAuthenticated,
  completedSlugs,
  trackColor,
}: {
  node: RoadmapNode
  isCompleted: boolean
  isAuthenticated: boolean
  completedSlugs: Set<string>
  trackColor: string
}) {
  const isLocked = isAuthenticated && !node.prerequisites.every((s) => completedSlugs.has(s))
  const href = nodeHref(node)
  const isClickable = !isLocked

  const card = (
    <div
      className={[
        'flex items-start gap-3 rounded-md border border-l-4 px-3 py-2.5 text-sm transition-colors',
        difficultyBorder(node.difficulty),
        isCompleted
          ? 'border-slate-200 bg-white'
          : isLocked
            ? 'border-slate-100 bg-slate-50 opacity-55'
            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer',
      ].join(' ')}
    >
      {/* Status icon */}
      <span className="shrink-0 mt-0.5 w-4 text-center">
        {isCompleted ? (
          <CheckIcon color={trackColor} />
        ) : isLocked ? (
          <LockIcon />
        ) : (
          <CircleIcon />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className={[
              'font-medium leading-snug',
              isLocked ? 'text-slate-400' : 'text-slate-900',
            ].join(' ')}
          >
            {node.title}
          </span>
          {node.interviewRelevance === 'high' && (
            <span className="shrink-0 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap">
              ⭐ Interview
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={[
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide',
              typeBadgeClass(node.type),
            ].join(' ')}
          >
            <NodeTypeIcon type={node.type} size={9} />
            {node.type}
          </span>
          {node.estimatedMinutes && (
            <span className="text-[10px] text-slate-400">{node.estimatedMinutes}min</span>
          )}
        </div>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    )
  }

  return card
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function NodeTypeIcon({ type, size = 10 }: { type: string; size?: number }) {
  if (type === 'PROBLEM')
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 8 L5 2 L8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.2 6h3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  if (type === 'ARTICLE')
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <rect x="1.5" y="1" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.5 4h3M3.5 6h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  // CONCEPT
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6.5" fill={color} fillOpacity="0.15" />
      <path
        d="M3.5 7.5l2.5 2.5 4.5-5.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-300" aria-hidden="true">
      <rect x="1.5" y="5.5" width="9" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-300" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
