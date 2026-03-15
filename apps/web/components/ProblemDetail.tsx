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

interface Props {
  problem: Problem
  descriptionHtml: string
  starterCode: string
  testCases: TestCase[]
}

type Tab = 'description' | 'discuss' | 'editorial'

const POLL_MAX_MS = 60_000
const POLL_MAX_FAILURES = 3

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

export function ProblemDetail({ problem, descriptionHtml, starterCode, testCases }: Props) {
  const { data: session } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>('description')
  const [code, setCode] = useState(starterCode)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const consecutivePollFailures = useRef(0)

  const createMutation = trpc.submission.create.useMutation({
    onSuccess(data) {
      setSubmissionId(data.submissionId)
      setIsPolling(true)
      setDrawerOpen(true)
      setSubmitError(null)
      setPollError(null)
      consecutivePollFailures.current = 0
    },
    onError(err) {
      if (err.data?.code === 'UNAUTHORIZED') {
        router.push(`/signin?callbackUrl=/problems/${problem.slug}`)
      } else {
        setDrawerOpen(true)
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

  // Stop polling on terminal status
  useEffect(() => {
    if (!submissionStatus) return
    const terminal = ['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT']
    if (terminal.includes(submissionStatus.status)) {
      setIsPolling(false)
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
    createMutation.mutate({ problemSlug: problem.slug, code, language: 'cpp' })
  }

  const currentStatus = submissionStatus?.status as keyof typeof SUBMISSION_STATUS_COLORS | undefined
  const statusCfg = currentStatus
    ? SUBMISSION_STATUS_COLORS[currentStatus]
    : SUBMISSION_STATUS_COLORS.PENDING
  const statusLabel = currentStatus
    ? SUBMISSION_STATUS_LABELS[currentStatus]
    : SUBMISSION_STATUS_LABELS.PENDING

  const isPending =
    !submissionStatus ||
    submissionStatus.status === 'PENDING' ||
    submissionStatus.status === 'RUNNING'

  const isSubmitting = createMutation.isPending || isPolling

  const diff = problem.difficulty as keyof typeof DIFFICULTY_COLORS

  return (
    /* Mobile: flex-col, scrollable. Desktop: fixed-height flex-col */
    <div className="flex flex-col min-h-[calc(100vh-56px)] md:h-[calc(100vh-56px)] md:overflow-hidden">
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
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              {(['description', 'discuss', 'editorial'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm capitalize transition-colors relative ${
                    activeTab === tab
                      ? 'text-blue-600 font-medium'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                  {tab === 'editorial' && <span className="ml-1 text-xs">🔒</span>}
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
                <div className="px-5 py-8 text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="text-slate-600 text-sm">
                    Solve the problem to unlock the editorial.
                  </p>
                </div>
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
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
                {isSubmitting ? 'Running…' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco editor: fixed height on mobile, flexible on desktop */}
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
        </div>
      </div>

      {/* ── Bottom drawer ─────────────────────────────────────── */}
      <div
        className={`border-t border-slate-200 bg-white overflow-hidden transition-all duration-300 ${
          drawerOpen ? 'h-72' : 'h-0'
        }`}
      >
        {drawerOpen && (
          <div className="h-full flex flex-col">
            {/* Drawer header */}
            <div
              className={`flex items-center justify-between px-4 py-2 border-b border-slate-200 ${
                submitError || pollError ? 'bg-red-50' : statusCfg.panelBg
              }`}
            >
              <div className="flex items-center gap-2">
                {isPending && !submitError && !pollError && (
                  <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
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
                <span
                  className={`text-sm font-semibold ${
                    submitError || pollError ? 'text-red-700' : statusCfg.text
                  }`}
                >
                  {submitError
                    ? 'Submission Error'
                    : pollError
                      ? 'Connection Lost'
                      : statusLabel}
                </span>
                {submissionStatus?.runtimeMs != null && (
                  <span className="text-xs text-slate-500 ml-2">
                    {submissionStatus.runtimeMs} ms
                  </span>
                )}
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Inline error messages */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}
              {pollError && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-700">{pollError}</p>
                </div>
              )}
              {!submitError && !pollError && isPending && !submissionStatus && (
                <p className="text-slate-500 text-sm">Submission queued. Waiting for judge…</p>
              )}
              {!submitError && !pollError && isPending && submissionStatus?.status === 'RUNNING' && (
                <p className="text-slate-600 text-sm">Running test cases…</p>
              )}
              {submissionStatus?.errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">
                    {submissionStatus.errorMsg}
                  </p>
                </div>
              )}
              {submissionStatus?.output && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <p className="text-xs text-slate-500 mb-1 font-medium">Output</p>
                  <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">
                    {submissionStatus.output}
                  </pre>
                </div>
              )}
              {/* Test case summary */}
              {testCases.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    Test Cases
                  </p>
                  {testCases.map((tc, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 gap-3 text-xs"
                    >
                      <div>
                        <span className="text-slate-500 block mb-0.5">Input</span>
                        <pre className="text-slate-700 font-mono whitespace-pre-wrap">{tc.input}</pre>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Expected</span>
                        <pre className="text-slate-700 font-mono whitespace-pre-wrap">
                          {tc.expected}
                        </pre>
                      </div>
                      <div className="col-span-2 flex items-center gap-1 text-slate-400">
                        <span>{tc.name}</span>
                        {submissionStatus?.status !== 'PENDING' &&
                          submissionStatus?.status !== 'RUNNING' && (
                            <span
                              className={
                                submissionStatus?.status === 'ACCEPTED'
                                  ? 'text-green-600 ml-auto'
                                  : 'text-red-600 ml-auto'
                              }
                            >
                              {submissionStatus?.status === 'ACCEPTED' ? '✓ Pass' : '✗ Fail'}
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
