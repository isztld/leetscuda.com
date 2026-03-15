'use client'

import Link from 'next/link'
import Image from 'next/image'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type SubmissionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'

export interface ProfileData {
  user: {
    username: string
    avatarUrl: string | null
    role: string
    xp: number
    streakDays: number
    createdAt: string
  }
  stats: {
    totalSolved: number
    solvedByDifficulty: { easy: number; medium: number; hard: number }
    solvedByTrack: {
      trackSlug: string
      trackTitle: string
      color: string
      solved: number
      total: number
    }[]
    totalSubmissions: number
    acceptanceRate: number
  }
  recentSubmissions: {
    id: string
    problemSlug: string
    problemTitle: string
    status: string
    runtimeMs: number | null
    submittedAt: string
  }[]
  solvedProblems: {
    slug: string
    title: string
    difficulty: string
    trackTitle: string
    trackColor: string
    solvedAt: string
    xpReward: number
  }[]
}

const INITIAL_COLORS = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-pink-600',
  'bg-cyan-600',
]

function avatarBg(username: string): string {
  return INITIAL_COLORS[username.charCodeAt(0) % INITIAL_COLORS.length]
}

function difficultyStyle(difficulty: string) {
  switch (difficulty) {
    case 'EASY':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'HARD':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

function statusStyle(status: string) {
  switch (status as SubmissionStatus) {
    case 'ACCEPTED':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'WRONG_ANSWER':
    case 'RUNTIME_ERROR':
      return 'bg-red-500/20 text-red-400'
    case 'TIME_LIMIT':
      return 'bg-orange-500/20 text-orange-400'
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return 'Accepted'
    case 'WRONG_ANSWER':
      return 'Wrong Answer'
    case 'RUNTIME_ERROR':
      return 'Runtime Error'
    case 'TIME_LIMIT':
      return 'Time Limit'
    case 'RUNNING':
      return 'Running'
    case 'PENDING':
      return 'Pending'
    default:
      return status
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-sm text-zinc-400">{label}</span>
    </div>
  )
}

export function ProfileClient({ data }: { data: ProfileData }) {
  const { user, stats, recentSubmissions, solvedProblems } = data

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* ── User card ────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-start gap-6">
          {/* Avatar */}
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.username}
              width={80}
              height={80}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold ${avatarBg(user.username)}`}
            >
              {user.username[0].toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white truncate">{user.username}</h1>
              {user.role === 'CONTRIBUTOR' && (
                <span className="bg-blue-500/20 text-blue-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Contributor
                </span>
              )}
              {user.role === 'ADMIN' && (
                <span className="bg-violet-500/20 text-violet-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
              {/* XP */}
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                </svg>
                <span className="text-white font-semibold">{user.xp.toLocaleString()}</span> XP
              </span>

              {/* Member since */}
              <span>Joined {formatMemberSince(user.createdAt)}</span>

              {/* Streak */}
              {user.streakDays > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-white font-semibold">{user.streakDays}</span> day streak
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Problems Solved" value={stats.totalSolved} />
          <StatCard
            label="Acceptance Rate"
            value={stats.totalSubmissions === 0 ? '—' : `${stats.acceptanceRate}%`}
          />
          <StatCard label="Total Submissions" value={stats.totalSubmissions} />
          <StatCard label="Current Streak" value={`${user.streakDays}d`} />
        </div>

        {/* ── Difficulty breakdown ────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Difficulty Breakdown
          </h2>
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Easy &nbsp;
              <span className="font-bold">{stats.solvedByDifficulty.easy}</span>
            </span>
            <span className="flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              Medium &nbsp;
              <span className="font-bold">{stats.solvedByDifficulty.medium}</span>
            </span>
            <span className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Hard &nbsp;
              <span className="font-bold">{stats.solvedByDifficulty.hard}</span>
            </span>
          </div>
        </div>

        {/* ── Track progress ──────────────────────────────────────────── */}
        {stats.solvedByTrack.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              Track Progress
            </h2>
            <div className="space-y-4">
              {stats.solvedByTrack.map((track) => (
                <div
                  key={track.trackSlug}
                  className="pl-4 border-l-4"
                  style={{ borderLeftColor: track.color }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-zinc-200">{track.trackTitle}</span>
                    <span className="text-xs text-zinc-500">
                      {track.solved} / {track.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${track.total > 0 ? Math.round((track.solved / track.total) * 100) : 0}%`,
                        backgroundColor: track.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent submissions ──────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Recent Submissions
          </h2>
          {recentSubmissions.length === 0 ? (
            <p className="text-zinc-500 text-sm">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left border-b border-zinc-800">
                    <th className="pb-2 font-medium pr-4">Problem</th>
                    <th className="pb-2 font-medium pr-4">Status</th>
                    <th className="pb-2 font-medium pr-4">Runtime</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {recentSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/problems/${sub.problemSlug}`}
                          className="text-zinc-200 hover:text-white transition-colors"
                        >
                          {sub.problemTitle}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(sub.status)}`}
                        >
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400">
                        {sub.runtimeMs != null ? `${sub.runtimeMs} ms` : '—'}
                      </td>
                      <td className="py-2.5 text-zinc-500">{formatDate(sub.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Solved problems ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Solved Problems
          </h2>
          {solvedProblems.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">
                No problems solved yet.{' '}
                <Link href="/roadmap" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Start with the roadmap.
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {solvedProblems.map((problem) => (
                <Link
                  key={problem.slug}
                  href={`/problems/${problem.slug}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors flex flex-col gap-2"
                >
                  <span className="text-sm font-medium text-white leading-snug line-clamp-2">
                    {problem.title}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyStyle(problem.difficulty)}`}
                    >
                      {problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-zinc-400"
                      style={{
                        backgroundColor: `${problem.trackColor}20`,
                        color: problem.trackColor,
                      }}
                    >
                      {problem.trackTitle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-800">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 text-yellow-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                      </svg>
                      +{problem.xpReward} XP
                    </span>
                    <span>{formatDate(problem.solvedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
