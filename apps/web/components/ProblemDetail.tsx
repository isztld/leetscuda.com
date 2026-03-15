'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { MonacoEditor } from './MonacoEditor'
import { ErrorBoundary } from './ErrorBoundary'
import type { TestCase } from '@/lib/problems-content'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
} from '@/lib/constants'

// Matches SUBMISSION_MAX_CODE_BYTES server-side default — used for the UI indicator only
const MAX_CODE_BYTES = 16 * 1024

interface Problem {
  id: string
  slug: string
  title: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  xpReward: number
  track: {
    slug: string
    title: string
    color: string
  }
}

interface SubmissionTestResult {
  index: number
  passed: boolean
  input: string
  expected: string
  actual: string
  runtimeMs: number
}

interface Props {
  problem: Problem
  descriptionHtml: string
  starterCode: string
  testCases: TestCase[]
  editorialHtml: string | null
}

type Tab = 'description' | 'discuss' | 'editorial' | 'submissions'

const POLL_MAX_MS = 60_000
const POLL_MAX_FAILURES = 3
const TERMINAL_STATUSES = ['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT', 'CANCELLED']

function formatCodeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(date).toLocaleDateString()
}

function CopyCodeDescription({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.dataset.copyAdded) return
      pre.dataset.copyAdded = '1'
      pre.style.position = 'relative'

      const btn = document.createElement('button')
      btn.textContent = 'Copy'
      btn.className =
        'absolute top-2 right-2 text-[10px] font-medium text-slate-400 hover:text-slate-700 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded px-2 py-0.5 transition-colors leading-none'
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
        navigator.clipboard.writeText(code.trim()).catch(() => {})
        btn.textContent = 'Copied!'
        setTimeout(() => {
          btn.textContent = 'Copy'
        }, 1500)
      })
      pre.appendChild(btn)
    })
  })

  return (
    <div
      ref={ref}
      className="px-5 py-4 prose prose-slate prose-sm max-w-none
        prose-headings:text-slate-900
        prose-p:text-slate-700
        prose-li:text-slate-700
        prose-strong:text-slate-900
        prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-slate-900 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-700 prose-pre:p-0
        prose-pre:overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function DiffOutput({ expected, actual }: { expected: string; actual: string }) {
  if (expected === actual) {
    return <span className="text-slate-100">{actual}</span>
  }
  // Character-level diff highlight
  const chars = actual.split('')
  const expChars = expected.split('')
  return (
    <>
      {chars.map((ch, i) => {
        const differs = ch !== expChars[i]
        return (
          <span key={i} className={differs ? 'text-red-400 bg-red-900/30' : 'text-slate-100'}>
            {ch}
          </span>
        )
      })}
      {actual.length < expected.length && (
        <span className="text-red-400 opacity-50">
          {expected.slice(actual.length).replace(/./g, '_')}
        </span>
      )}
    </>
  )
}

function StatusBar({
  status,
  runtimeMs,
  testResults,
  xpReward,
  firstSolve,
}: {
  status: string
  runtimeMs: number | null | undefined
  testResults: SubmissionTestResult[] | null
  xpReward: number
  firstSolve: boolean
}) {
  const passedCount = testResults ? testResults.filter((t) => t.passed).length : 0
  const totalCount = testResults ? testResults.length : 0

  const cfg: Record<string, { bg: string; border: string; icon: string; textColor: string }> = {
    ACCEPTED: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: '✓',
      textColor: 'text-green-700',
    },
    WRONG_ANSWER: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '✗',
      textColor: 'text-red-700',
    },
    RUNTIME_ERROR: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '!',
      textColor: 'text-red-700',
    },
    TIME_LIMIT: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: '⏱',
      textColor: 'text-amber-700',
    },
    CANCELLED: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      icon: '—',
      textColor: 'text-slate-500',
    },
  }

  const c = cfg[status] ?? {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: '',
    textColor: 'text-slate-600',
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 border-b ${c.bg} ${c.border}`}>
      <span className={`font-bold text-sm ${c.textColor}`}>
        {c.icon && <span className="mr-1.5">{c.icon}</span>}
        {SUBMISSION_STATUS_LABELS[status as keyof typeof SUBMISSION_STATUS_LABELS] ?? status}
      </span>
      {runtimeMs != null && status === 'ACCEPTED' && (
        <span className="text-xs text-slate-500">Runtime: {runtimeMs}ms</span>
      )}
      {totalCount > 0 && (
        <span className="text-xs text-slate-500">
          Tests: {passedCount}/{totalCount} passed
        </span>
      )}
      {firstSolve && status === 'ACCEPTED' && (
        <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          +{xpReward} XP
        </span>
      )}
    </div>
  )
}

function TestResultPanel({
  testResults,
  status,
  errorMsg,
}: {
  testResults: SubmissionTestResult[]
  status: string
  errorMsg: string | null | undefined
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = testResults[activeIdx]

  if (!active) return null

  return (
    <div className="flex flex-col h-full">
      {/* Test tabs */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-slate-100 flex-wrap">
        {testResults.map((tr, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeIdx === i
                ? tr.passed
                  ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                  : 'bg-red-100 text-red-700 ring-1 ring-red-400'
                : tr.passed
                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            {tr.passed ? '✓' : '✗'} Test {i + 1}
          </button>
        ))}
      </div>

      {/* Active test detail */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {status === 'RUNTIME_ERROR' && !active.passed ? (
          <div className="bg-red-950/20 border border-red-300 rounded p-3">
            <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
              {errorMsg ?? active.actual}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Input', content: active.input, diff: false },
              { label: 'Expected', content: active.expected, diff: false },
              { label: 'Output', content: active.actual, diff: !active.passed },
            ].map(({ label, content, diff }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 mb-1 font-medium">{label}</p>
                <div className="bg-slate-900 rounded p-2 font-mono text-xs leading-relaxed overflow-x-auto">
                  {diff ? (
                    <DiffOutput expected={active.expected} actual={active.actual} />
                  ) : (
                    <span className="text-slate-100">{content}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="col-span-3 flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Runtime: {active.runtimeMs}ms</span>
              {active.passed ? (
                <span className="text-green-600 font-medium">Passed</span>
              ) : (
                <span className="text-red-600 font-medium">Failed</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PendingPanel({
  submissionId,
  submissionStatus,
  cancelMutation,
  cancelError,
}: {
  submissionId: string | null
  submissionStatus: { status: string } | undefined
  cancelMutation: { mutate: (arg: { submissionId: string }) => void; isPending: boolean }
  cancelError: string | null
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="animate-spin h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-slate-600 text-sm">
          {submissionStatus?.status === 'RUNNING'
            ? 'Running test cases…'
            : 'Waiting for judge…'}
        </p>
      </div>

      {/* Animated skeleton for test tabs */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-16 bg-slate-200 animate-pulse rounded-full" />
        ))}
      </div>

      {submissionId && submissionStatus?.status !== 'RUNNING' && (
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => cancelMutation.mutate({ submissionId })}
            disabled={cancelMutation.isPending}
            className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
          >
            Cancel submission
          </button>
          {cancelError && <span className="text-xs text-slate-500">{cancelError}</span>}
        </div>
      )}
    </div>
  )
}

function CodeViewerModal({
  submission,
  onClose,
}: {
  submission: { id: string; number: number; status: string; code: string; submittedAt: Date | string }
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              Submission #{submission.number}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                SUBMISSION_STATUS_COLORS[
                  submission.status as keyof typeof SUBMISSION_STATUS_COLORS
                ]?.bg ?? 'bg-slate-100'
              } ${
                SUBMISSION_STATUS_COLORS[
                  submission.status as keyof typeof SUBMISSION_STATUS_COLORS
                ]?.text ?? 'text-slate-600'
              }`}
            >
              {SUBMISSION_STATUS_LABELS[
                submission.status as keyof typeof SUBMISSION_STATUS_LABELS
              ] ?? submission.status}
            </span>
            <span className="text-xs text-slate-400">
              {formatRelativeTime(submission.submittedAt)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50 h-full overflow-auto">
            {submission.code}
          </pre>
        </div>
      </div>
    </div>
  )
}

export function ProblemDetail({
  problem,
  descriptionHtml,
  starterCode,
  testCases,
  editorialHtml,
}: Props) {
  const { data: session } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>('description')
  const [code, setCode] = useState(starterCode)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [isSolved, setIsSolved] = useState(false)
  const [showSolvedBanner, setShowSolvedBanner] = useState(false)
  const [viewingCode, setViewingCode] = useState<{
    id: string
    number: number
    status: string
    code: string
    submittedAt: Date | string
  } | null>(null)
  const consecutivePollFailures = useRef(0)
  const initializedFromLatest = useRef(false)
  const confettiFiredRef = useRef(false)

  // On-mount: check if there's already a pending/running submission and if problem is solved
  const { data: latestSubmission } = trpc.submission.getLatestForProblem.useQuery(
    { problemSlug: problem.slug },
    { enabled: !!session, staleTime: 0 },
  )

  useEffect(() => {
    if (initializedFromLatest.current) return
    if (latestSubmission === undefined) return
    initializedFromLatest.current = true

    if (latestSubmission?.isSolved) {
      setIsSolved(true)
    }

    if (
      latestSubmission?.submissionId &&
      (latestSubmission.status === 'PENDING' || latestSubmission.status === 'RUNNING')
    ) {
      setSubmissionId(latestSubmission.submissionId)
      setIsPolling(true)
      setDrawerOpen(true)
      consecutivePollFailures.current = 0
    }
  }, [latestSubmission])

  // Daily submission count
  const { data: dailyCount } = trpc.submission.getDailyCount.useQuery(undefined, {
    enabled: !!session,
  })

  // Problem stats
  const { data: problemStats } = trpc.problems.getStats.useQuery(
    { slug: problem.slug },
    { staleTime: 60_000 },
  )

  // Submission history
  const { data: historyData } = trpc.submission.getHistoryForProblem.useQuery(
    { problemSlug: problem.slug },
    { enabled: !!session && activeTab === 'submissions' },
  )

  const isLimitReached = !!(
    dailyCount &&
    !dailyCount.unlimited &&
    dailyCount.limit > 0 &&
    dailyCount.used >= dailyCount.limit
  )

  const cancelMutation = trpc.submission.cancel.useMutation({
    onSuccess(data) {
      if (data.cancelled) {
        setDrawerOpen(false)
        setSubmissionId(null)
        setIsPolling(false)
        setCancelError(null)
        setInfoMsg('Submission cancelled')
        setTimeout(() => setInfoMsg(null), 3000)
      } else {
        setCancelError(
          `Could not cancel — submission is already ${(data.currentStatus as string).toLowerCase().replace('_', ' ')}`,
        )
      }
    },
  })

  const createMutation = trpc.submission.create.useMutation({
    onSuccess(data) {
      setSubmissionId(data.submissionId)
      setIsPolling(true)
      setDrawerOpen(true)
      setSubmitError(null)
      setPollError(null)
      setCancelError(null)
      setInfoMsg(null)
      consecutivePollFailures.current = 0
    },
    onError(err) {
      if (err.data?.code === 'UNAUTHORIZED') {
        router.push(`/signin?callbackUrl=/problems/${problem.slug}`)
        return
      }

      setDrawerOpen(true)

      let parsed: { code?: string; submissionId?: string; message?: string } = {}
      try {
        parsed = JSON.parse(err.message) as typeof parsed
      } catch {
        // not a structured error
      }

      switch (parsed.code) {
        case 'PENDING_SUBMISSION':
          if (parsed.submissionId) {
            setSubmissionId(parsed.submissionId)
            setIsPolling(true)
            setPollError(null)
            consecutivePollFailures.current = 0
          } else {
            setSubmitError('Submission failed. Please try again.')
          }
          break
        case 'DAILY_LIMIT_REACHED':
          setSubmitError('Daily limit reached. Upgrade for unlimited submissions.')
          break
        case 'RATE_LIMITED':
          setSubmitError('Too many submissions. Wait a moment.')
          break
        case 'CODE_TOO_LARGE':
          setSubmitError('Code exceeds 16 KB limit.')
          break
        default:
          setSubmitError('Submission failed. Please try again.')
      }
    },
  })

  const { data: submissionStatus, isError: statusIsError } =
    trpc.submission.getStatus.useQuery(
      { submissionId: submissionId ?? '' },
      {
        enabled: !!submissionId && isPolling,
        refetchInterval: isPolling ? 1500 : false,
        retry: false,
      },
    )

  // Stop polling on terminal status; handle first solve
  useEffect(() => {
    if (!submissionStatus) return
    if (TERMINAL_STATUSES.includes(submissionStatus.status)) {
      setIsPolling(false)

      if (submissionStatus.status === 'ACCEPTED') {
        setIsSolved(true)

        if (submissionStatus.firstSolve && !confettiFiredRef.current) {
          confettiFiredRef.current = true
          setShowSolvedBanner(true)
          setTimeout(() => setShowSolvedBanner(false), 5000)

          // Fire confetti
          import('canvas-confetti').then((mod) => {
            const confetti = mod.default
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
          })

          // Auto-switch to editorial after 2s if user hasn't navigated
          setTimeout(() => {
            setActiveTab((t) => (t === 'description' || t === 'submissions') ? 'editorial' : t)
          }, 2000)
        }
      }
    } else {
      consecutivePollFailures.current = 0
    }
  }, [submissionStatus])

  // Track consecutive poll failures
  useEffect(() => {
    if (!isPolling) return
    if (statusIsError) {
      consecutivePollFailures.current += 1
      if (consecutivePollFailures.current >= POLL_MAX_FAILURES) {
        setIsPolling(false)
        setPollError('Lost connection to judge. Please check your submission history.')
      }
    }
  }, [statusIsError, isPolling])

  // 60-second polling timeout
  useEffect(() => {
    if (!isPolling) return
    const timer = setTimeout(() => {
      setIsPolling(false)
      setPollError('Judge is taking longer than expected. Check back shortly.')
    }, POLL_MAX_MS)
    return () => clearTimeout(timer)
  }, [isPolling])

  function handleSubmit() {
    if (!session) {
      router.push(`/signin?callbackUrl=/problems/${problem.slug}`)
      return
    }
    setInfoMsg(null)
    createMutation.mutate({ problemSlug: problem.slug, code, language: 'cpp' })
  }

  const isPending =
    !submissionStatus ||
    submissionStatus.status === 'PENDING' ||
    submissionStatus.status === 'RUNNING'

  const isSubmitting = createMutation.isPending || isPolling

  const diff = problem.difficulty as keyof typeof DIFFICULTY_COLORS

  // Code size indicator
  const codeSizeBytes = new TextEncoder().encode(code).length
  const codePct = codeSizeBytes / MAX_CODE_BYTES
  const codeSizeColor =
    codePct >= 0.95 ? 'text-red-500' : codePct >= 0.8 ? 'text-amber-500' : 'text-slate-400'

  // Cast through unknown to avoid Prisma JsonValue's recursive type causing TS2589
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _statusAny = submissionStatus as any
  const testResults: SubmissionTestResult[] | null =
    Array.isArray(_statusAny?.testResults) ? (_statusAny.testResults as SubmissionTestResult[]) : null

  const isTerminal =
    submissionStatus && TERMINAL_STATUSES.includes(submissionStatus.status)

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] md:h-[calc(100vh-56px)] md:overflow-hidden">
      {/* Code viewer modal */}
      {viewingCode && (
        <CodeViewerModal submission={viewingCode} onClose={() => setViewingCode(null)} />
      )}

      {/* Solved banner */}
      {showSolvedBanner && (
        <div className="bg-green-50 border-b border-green-200 text-green-800 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-medium">
            Problem solved! +{problem.xpReward} XP earned
          </span>
          <button
            onClick={() => setShowSolvedBanner(false)}
            className="text-green-600 hover:text-green-800 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Main split pane */}
      <div className="flex flex-col md:flex-row flex-1 md:min-h-0 md:overflow-hidden">
        {/* ── Left panel ───────────────────────────────── */}
        <ErrorBoundary
          fallback={
            <div className="w-full md:w-2/5 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 py-12 md:py-0 bg-white">
              <p className="text-slate-500 text-sm px-4 text-center">
                Failed to load problem description. Please refresh.
              </p>
            </div>
          }
        >
          <div className="w-full md:w-2/5 flex flex-col bg-white border-b border-slate-200 md:border-b-0 md:border-r md:min-h-0">
            {/* Problem header */}
            <div className="px-5 py-4 border-b border-slate-200 shrink-0">
              <h1 className="text-lg font-semibold text-slate-900 mb-2">{problem.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[diff].bg} ${DIFFICULTY_COLORS[diff].text}`}
                >
                  {DIFFICULTY_LABELS[diff]}
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full text-slate-700 bg-slate-100"
                  style={{ borderLeft: `3px solid ${problem.track.color}` }}
                >
                  {problem.track.title}
                </span>
                <span className="text-xs text-amber-600 font-medium ml-auto">
                  +{problem.xpReward} XP
                </span>
              </div>

              {/* Problem stats row */}
              {problemStats && (
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Accepted: {problemStats.totalAccepted}</span>
                  <span>Submissions: {problemStats.totalSubmissions}</span>
                  <span>Acceptance: {problemStats.acceptanceRate}%</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
              {(['description', 'discuss', 'editorial', 'submissions'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors relative ${
                    activeTab === tab
                      ? 'text-blue-600 font-medium'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'editorial' ? (
                    isSolved ? (
                      <span>Editorial <span className="text-green-500 text-xs">✓</span></span>
                    ) : (
                      <span>Editorial <span className="text-xs">🔒</span></span>
                    )
                  ) : tab === 'submissions' ? (
                    'Submissions'
                  ) : (
                    <span className="capitalize">{tab}</span>
                  )}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto md:min-h-0">
              {activeTab === 'description' && (
                <CopyCodeDescription html={descriptionHtml} />
              )}
              {activeTab === 'discuss' && (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">
                  Comments coming soon
                </div>
              )}
              {activeTab === 'editorial' && (
                isSolved ? (
                  editorialHtml ? (
                    <div
                      className="px-5 py-4 prose prose-slate prose-sm max-w-none
                        prose-headings:text-slate-900
                        prose-p:text-slate-700
                        prose-li:text-slate-700
                        prose-strong:text-slate-900
                        prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-pre:bg-slate-900 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-700 prose-pre:p-0
                        prose-pre:overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: editorialHtml }}
                    />
                  ) : (
                    <div className="px-5 py-8 text-center text-slate-500 text-sm">
                      Editorial not available yet.
                    </div>
                  )
                ) : (
                  <div className="relative px-5 py-8">
                    {editorialHtml && (
                      <div
                        className="select-none pointer-events-none blur-sm opacity-40 prose prose-slate prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: editorialHtml }}
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-4xl mb-3">🔒</div>
                      <p className="text-slate-600 text-sm text-center px-4">
                        Solve this problem to unlock the editorial.
                      </p>
                    </div>
                  </div>
                )
              )}
              {activeTab === 'submissions' && (
                session ? (
                  <div className="px-3 py-3">
                    {!historyData || historyData.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">
                        No submissions yet.
                      </p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-100">
                            <th className="text-left py-1.5 pr-2 font-medium">#</th>
                            <th className="text-left py-1.5 pr-2 font-medium">Status</th>
                            <th className="text-left py-1.5 pr-2 font-medium">Runtime</th>
                            <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                            <th className="text-left py-1.5 font-medium">Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.map((sub) => {
                            const sc =
                              SUBMISSION_STATUS_COLORS[
                                sub.status as keyof typeof SUBMISSION_STATUS_COLORS
                              ]
                            return (
                              <tr
                                key={sub.id}
                                className="border-b border-slate-50 hover:bg-slate-50"
                              >
                                <td className="py-2 pr-2 text-slate-400">{sub.number}</td>
                                <td className="py-2 pr-2">
                                  <span
                                    className={`font-medium ${sc?.text ?? 'text-slate-600'}`}
                                  >
                                    {sub.status === 'ACCEPTED' ? '✓ ' : '✗ '}
                                    {SUBMISSION_STATUS_LABELS[
                                      sub.status as keyof typeof SUBMISSION_STATUS_LABELS
                                    ] ?? sub.status}
                                  </span>
                                </td>
                                <td className="py-2 pr-2 text-slate-500">
                                  {sub.runtimeMs != null ? `${sub.runtimeMs}ms` : '—'}
                                </td>
                                <td className="py-2 pr-2 text-slate-400">
                                  {formatRelativeTime(sub.submittedAt)}
                                </td>
                                <td className="py-2">
                                  <button
                                    onClick={() =>
                                      setViewingCode({
                                        id: sub.id,
                                        number: sub.number,
                                        status: sub.status,
                                        code: sub.code,
                                        submittedAt: sub.submittedAt,
                                      })
                                    }
                                    className="text-blue-500 hover:text-blue-700 font-mono"
                                    title="View code"
                                  >
                                    {'</>'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-slate-500 text-sm">
                    <button
                      onClick={() => router.push(`/signin?callbackUrl=/problems/${problem.slug}`)}
                      className="text-blue-600 hover:underline"
                    >
                      Sign in
                    </button>{' '}
                    to view your submissions.
                  </div>
                )
              )}
            </div>
          </div>
        </ErrorBoundary>

        {/* ── Right panel ─────────────────────────────── */}
        <div className="w-full md:w-3/5 flex flex-col md:min-h-0">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <select
                className="text-xs bg-white text-slate-700 rounded px-2 py-1 border border-slate-200 focus:outline-none"
                defaultValue="cpp"
                disabled
              >
                <option value="cpp">C++ / CUDA</option>
              </select>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isLimitReached}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && (
                  <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {isSubmitting ? 'Running…' : isSolved ? 'Resubmit' : 'Submit'}
              </button>
              {infoMsg && (
                <p className="text-[10px] text-green-600">{infoMsg}</p>
              )}
              {!infoMsg && dailyCount && !dailyCount.unlimited && (
                <p className="text-[10px] text-slate-400">
                  {dailyCount.used} / {dailyCount.limit} today
                </p>
              )}
            </div>
          </div>

          {/* Monaco editor */}
          <div className="h-[55vh] md:h-auto md:flex-1 md:min-h-0">
            <ErrorBoundary
              fallback={
                <div className="flex h-full items-center justify-center bg-slate-50">
                  <p className="text-slate-500 text-sm">
                    Editor failed to load. Try refreshing the page.
                  </p>
                </div>
              }
            >
              <MonacoEditor value={code} onChange={setCode} language="cpp" />
            </ErrorBoundary>
          </div>

          {/* Code size indicator */}
          <div
            className={`px-3 py-1 text-xs border-t border-slate-200 bg-white text-right shrink-0 ${codeSizeColor}`}
          >
            {formatCodeSize(codeSizeBytes)} / 16 KB
          </div>
        </div>
      </div>

      {/* ── Bottom drawer ─────────────────────────────────────── */}
      <div
        className={`border-t border-slate-200 bg-white overflow-hidden transition-all duration-300 shrink-0 ${
          drawerOpen ? 'h-72' : 'h-0'
        }`}
      >
        {drawerOpen && (
          <div className="h-full flex flex-col">
            {/* Drawer header / status bar */}
            {submitError || pollError ? (
              <div className="flex items-center justify-between px-4 py-2 border-b border-red-200 bg-red-50">
                <span className="text-sm font-semibold text-red-700">
                  {submitError ? 'Submission Error' : 'Connection Lost'}
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ) : isTerminal && submissionStatus ? (
              <div className="flex items-center justify-between shrink-0">
                <div className="flex-1">
                  <StatusBar
                    status={submissionStatus.status}
                    runtimeMs={submissionStatus.runtimeMs}
                    testResults={testResults}
                    xpReward={problem.xpReward}
                    firstSolve={submissionStatus.firstSolve ?? false}
                  />
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none px-3 shrink-0"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-slate-600">
                    {submissionStatus?.status === 'RUNNING'
                      ? 'Running…'
                      : 'Waiting for judge…'}
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )}

            {/* Drawer body */}
            {submitError || pollError ? (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-700">{submitError ?? pollError}</p>
                </div>
              </div>
            ) : isTerminal && submissionStatus ? (
              testResults && testResults.length > 0 ? (
                <TestResultPanel
                  testResults={testResults}
                  status={submissionStatus.status}
                  errorMsg={submissionStatus.errorMsg}
                />
              ) : (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {submissionStatus.errorMsg && (
                    <div className="bg-red-950/10 border border-red-200 rounded p-3">
                      <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">
                        {submissionStatus.errorMsg}
                      </p>
                    </div>
                  )}
                  {submissionStatus.output && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <p className="text-xs text-slate-500 mb-1 font-medium">Output</p>
                      <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">
                        {submissionStatus.output}
                      </pre>
                    </div>
                  )}
                  {submissionStatus.status === 'CANCELLED' && (
                    <p className="text-sm text-slate-500">Submission cancelled.</p>
                  )}
                </div>
              )
            ) : (
              <PendingPanel
                submissionId={submissionId}
                submissionStatus={submissionStatus}
                cancelMutation={cancelMutation}
                cancelError={cancelError}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
