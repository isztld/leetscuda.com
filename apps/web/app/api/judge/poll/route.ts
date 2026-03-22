import { NextRequest, NextResponse } from 'next/server'
import { authenticateJudge } from '@/lib/judge-auth'
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { loadProblemContent } from '@/lib/problems-content'

const POLL_TIMEOUT_S = 30
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX = 60

function parseSm(sm: string): number {
  return parseInt(sm.replace('sm_', ''), 10)
}

function isCudaCompatible(
  judgeVersion: string,
  judgeSm: string,
  jobMinVersion: string,
  jobMinSm: string,
): boolean {
  const [jMajor, jMinor = 0] = judgeVersion.split('.').map(Number)
  const [mMajor, mMinor = 0] = jobMinVersion.split('.').map(Number)
  const versionOk = jMajor > mMajor || (jMajor === mMajor && jMinor >= mMinor)
  const smOk = parseSm(judgeSm) >= parseSm(jobMinSm)
  return versionOk && smOk
}

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
      queues.push('judge:queue:cuda')
    } else if (cap === 'k8s') {
      queues.push('judge:queue:k8s')
    }
  }
  // Deduplicate (a judge with multiple cuda caps would add the queue twice)
  const uniqueQueues = [...new Set(queues)]

  if (uniqueQueues.length === 0 || !redis) {
    return new NextResponse(null, { status: 204 })
  }

  // 4. BLPOP from all eligible queues — pops from whichever has a job first
  let payload: string | null = null
  try {
    const result = await redis.blpop(...uniqueQueues, POLL_TIMEOUT_S)
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
    cppStandard?: string
    cudaMinVersion?: string
    computeMinCap?: string
  }
  try {
    job = JSON.parse(payload)
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  // 4a. For CUDA jobs, verify the judge can satisfy the problem's minimum requirements
  if (job.runtime === 'cuda' && job.cudaMinVersion && job.computeMinCap) {
    const cudaCap = judge.capabilities
      .map((c) => c.split(':'))
      .find((parts) => parts[0] === 'cuda' && parts.length === 3)

    if (cudaCap) {
      const [, judgeVersion, judgeSm] = cudaCap
      if (!isCudaCompatible(judgeVersion, judgeSm, job.cudaMinVersion, job.computeMinCap)) {
        // Re-queue the job and signal no-work — another judge with a higher-capability GPU will pick it up
        await redis.rpush('judge:queue:cuda', payload)
        await new Promise((r) => setTimeout(r, 1000))
        return new NextResponse(null, { status: 204 })
      }
    }
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

  // 7. K8s job — load k8s checks from MDX and return K8s job format
  if (job.runtime === 'k8s') {
    let k8sChecks: unknown[] = []
    let k8sMultiDoc = false
    try {
      const content = await loadProblemContent(submission.problem.track.slug, job.problemSlug)
      k8sChecks = content.k8sChecks
      // Load k8s_multi_doc from frontmatter by re-reading the raw file
      const matter = await import('gray-matter')
      const fs = await import('fs')
      const path = await import('path')
      const learningDir = path.join(process.cwd(), '../../learning')
      const mdxPath = path.join(learningDir, submission.problem.track.slug, 'problems', job.problemSlug, 'index.mdx')
      if (fs.existsSync(mdxPath)) {
        const raw = fs.readFileSync(mdxPath, 'utf8')
        const { data } = matter.default(raw)
        k8sMultiDoc = data.k8s_multi_doc === true
      }
    } catch (err) {
      await prisma.submission.update({
        where: { id: job.submissionId },
        data: {
          status: 'RUNTIME_ERROR',
          errorMsg: `Failed to load K8s checks: ${err instanceof Error ? err.message : String(err)}`,
        },
      })
      return new NextResponse(null, { status: 204 })
    }

    return NextResponse.json({
      submissionId: job.submissionId,
      problemSlug: job.problemSlug,
      code: job.code,
      language: 'yaml',
      runtime: 'k8s',
      k8sMultiDoc,
      k8sChecks,
      timeoutMs: 10_000,
    })
  }

  // 8. Load test cases from MDX (server has access to the problems directory)
  let testCases: { input: string; expected: string }[] = []
  let harness = ''
  try {
    const content = await loadProblemContent(submission.problem.track.slug, job.problemSlug)
    testCases = content.testCases.map(({ input, expected }) => ({ input, expected }))
    harness = content.harness
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
    harness,
    language: 'cpp',
    runtime: job.runtime ?? 'cpp',
    cppStandard: job.cppStandard ?? '17',
    cudaMinVersion: job.cudaMinVersion ?? undefined,
    computeMinCap: job.computeMinCap ?? undefined,
    testCases,
    timeoutMs: 10_000,
  })
}
