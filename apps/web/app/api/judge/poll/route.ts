import { NextRequest, NextResponse } from 'next/server'
import { authenticateJudge } from '@/lib/judge-auth'
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { loadProblemContent } from '@/lib/problems-content'

const POLL_TIMEOUT_S = 30
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX = 60

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const judge = await authenticateJudge(req)
  if (!judge) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit: 60 requests/minute per token via Redis
  const redis = getRedis()
  if (redis) {
    const rateLimitKey = `rate:judge:poll:${judge.id}`
    const count = await redis.incr(rateLimitKey)
    if (count === 1) {
      await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_S)
    }
    if (count > RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
    }
  }

  // 3. Determine eligible queues from token capabilities
  const queues: string[] = []
  for (const cap of judge.capabilities) {
    if (cap === 'cpp') {
      queues.push('judge:queue:cpp')
    } else if (cap.startsWith('cuda:')) {
      const version = cap.slice(5) // e.g. "13.0"
      queues.push(`judge:queue:cuda:${version}`)
    }
  }

  if (queues.length === 0 || !redis) {
    return new NextResponse(null, { status: 204 })
  }

  // 4. BLPOP from all eligible queues — pops from whichever has a job first
  let payload: string | null = null
  try {
    const result = await redis.blpop(...queues, POLL_TIMEOUT_S)
    if (!result) return new NextResponse(null, { status: 204 })
    payload = result[1]
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  let job: {
    submissionId: string
    problemSlug: string
    code: string
    language: string
    runtime: string
    cppStandard: string
    cudaVersion?: string
    computeCap?: string
  }
  try {
    job = JSON.parse(payload)
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  // 5. Fetch submission + problem + track from Postgres
  const submission = await prisma.submission.findUnique({
    where: { id: job.submissionId },
    include: { problem: { include: { track: true } } },
  })

  if (!submission) {
    return new NextResponse(null, { status: 204 })
  }

  // 6. Mark submission as RUNNING
  await prisma.submission.update({
    where: { id: job.submissionId },
    data: { status: 'RUNNING' },
  })

  // 7. Load test cases from MDX (server has access to the problems directory)
  let testCases: { input: string; expected: string }[] = []
  try {
    const content = await loadProblemContent(submission.problem.track.slug, job.problemSlug)
    testCases = content.testCases.map(({ input, expected }) => ({ input, expected }))
  } catch (err) {
    // If we can't load test cases, mark the submission as error and return 204
    await prisma.submission.update({
      where: { id: job.submissionId },
      data: {
        status: 'RUNTIME_ERROR',
        errorMsg: `Failed to load test cases: ${err instanceof Error ? err.message : String(err)}`,
      },
    })
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    submissionId: job.submissionId,
    problemSlug: job.problemSlug,
    code: job.code,
    language: 'cpp',
    runtime: job.runtime ?? 'cpp',
    cppStandard: job.cppStandard ?? '17',
    cudaVersion: job.cudaVersion ?? undefined,
    computeCap: job.computeCap ?? undefined,
    testCases,
    timeoutMs: 10_000,
  })
}
