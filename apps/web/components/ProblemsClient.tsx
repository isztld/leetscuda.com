'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Difficulty, Track, Problem } from '@prisma/client'
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/lib/constants'

type ProblemWithTrack = Problem & { track: Track }

type Props = {
  problems: ProblemWithTrack[]
  tracks: Track[]
  solvedIds: string[] | null   // null = unauthenticated
  activeTrack: string | null
  activeDifficulty: Difficulty | null
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']

export function ProblemsClient({
  problems,
  tracks,
  solvedIds,
  activeTrack,
  activeDifficulty,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const solvedSet = new Set(solvedIds ?? [])
  const isAuthenticated = solvedIds !== null

  const filtered = search
    ? problems.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : problems

  const hasActiveFilter = activeTrack !== null || activeDifficulty !== null || search !== ''

  function pushFilter(track: string | null, difficulty: Difficulty | null) {
    const params = new URLSearchParams()
    if (track) params.set('track', track)
    if (difficulty) params.set('difficulty', difficulty)
    const qs = params.toString()
    router.push(`/problems${qs ? `?${qs}` : ''}`)
  }

  function clearFilters() {
    setSearch('')
    pushFilter(null, null)
  }

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-8">
        {/* Track pills */}
        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={activeTrack === null}
            onClick={() => pushFilter(null, activeDifficulty)}
          >
            All tracks
          </FilterPill>
          {tracks.map((t) => (
            <FilterPill
              key={t.id}
              active={activeTrack === t.slug}
              onClick={() => pushFilter(t.slug, activeDifficulty)}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: t.color }}
              />
              {t.title}
            </FilterPill>
          ))}
        </div>

        {/* Difficulty + search row */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={activeDifficulty === null}
            onClick={() => pushFilter(activeTrack, null)}
          >
            All difficulties
          </FilterPill>
          {DIFFICULTIES.map((d) => (
            <FilterPill
              key={d}
              active={activeDifficulty === d}
              onClick={() => pushFilter(activeTrack, d)}
            >
              <span className={`font-medium ${DIFFICULTY_COLORS[d].text}`}>
                {DIFFICULTY_LABELS[d]}
              </span>
            </FilterPill>
          ))}

          <input
            type="search"
            placeholder="Search problems…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-full sm:w-56 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {/* ── Problem table ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-400 text-sm mb-4">No problems match these filters.</p>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800 bg-zinc-900/50">
                <th className="py-3 px-4 text-left w-8 font-medium">Status</th>
                <th className="py-3 px-4 text-left font-medium">Title</th>
                <th className="py-3 px-4 text-left font-medium hidden sm:table-cell">
                  Difficulty
                </th>
                <th className="py-3 px-4 text-left font-medium hidden md:table-cell">Track</th>
                <th className="py-3 px-4 text-left font-medium hidden lg:table-cell">Tags</th>
                <th className="py-3 px-4 text-right font-medium">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((problem) => {
                const solved = solvedSet.has(problem.id)
                const diff = problem.difficulty as keyof typeof DIFFICULTY_COLORS
                return (
                  <tr
                    key={problem.id}
                    className="hover:bg-zinc-900/60 transition-colors"
                  >
                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {!isAuthenticated ? (
                        <span className="text-zinc-600">—</span>
                      ) : solved ? (
                        <CheckCircle />
                      ) : (
                        <EmptyCircle />
                      )}
                    </td>

                    {/* Title */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/problems/${problem.slug}`}
                        className="font-medium text-white hover:text-violet-400 transition-colors"
                      >
                        {problem.title}
                      </Link>
                      {/* Show difficulty inline on mobile */}
                      <span
                        className={`ml-2 inline-block sm:hidden px-1.5 py-0.5 rounded text-[10px] font-semibold ${DIFFICULTY_COLORS[diff].bg} ${DIFFICULTY_COLORS[diff].text}`}
                      >
                        {DIFFICULTY_LABELS[diff]}
                      </span>
                    </td>

                    {/* Difficulty */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${DIFFICULTY_COLORS[diff].bg} ${DIFFICULTY_COLORS[diff].text}`}
                      >
                        {DIFFICULTY_LABELS[diff]}
                      </span>
                    </td>

                    {/* Track */}
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: problem.track.color }}
                        />
                        <span className="text-zinc-300 text-xs">{problem.track.title}</span>
                      </span>
                    </td>

                    {/* Tags */}
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {problem.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* XP */}
                    <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums">
                      +{problem.xpReward}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-600 text-right">
        {filtered.length} problem{filtered.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-zinc-700 text-white'
          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
      }`}
    >
      {children}
    </button>
  )
}

function CheckCircle() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-label="Solved"
      className="animate-check-in"
    >
      <circle cx="9" cy="9" r="9" fill="#166534" fillOpacity="0.4" />
      <path
        d="M5.5 9.5l2.5 2.5 4.5-5"
        stroke="#4ade80"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-label="Unsolved">
      <circle cx="9" cy="9" r="8" stroke="#3f3f46" strokeWidth="1.5" />
    </svg>
  )
}
