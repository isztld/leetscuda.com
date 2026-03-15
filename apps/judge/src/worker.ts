import 'dotenv/config'
import './env.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Redis } from 'ioredis'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import { getPrisma } from './db.js'
import { JudgeJobSchema } from './types.js'
import { runInSandbox } from './sandbox.js'
import { verify } from './verifier.js'
import { updateStreak } from './streak.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// PROBLEMS_PATH env var is relative to the judge's working directory
const PROBLEMS_DIR = path.resolve(
  process.cwd(),
  process.env.PROBLEMS_PATH ?? '../../problems',
)

const TIMEOUT_MS = 10_000

interface TestCase {
  name: string
  input: string
  expected: string
}

function loadTestCases(trackSlug: string, problemSlug: string): TestCase[] {
  const filePath = path.join(PROBLEMS_DIR, trackSlug, problemSlug, 'index.mdx')
  const raw = fs.readFileSync(filePath, 'utf8')
  const { content } = matter(raw)

  const [, rest1 = ''] = content.split('---starter-code---')
  const [, rest2 = ''] = rest1.split('---test-cases---')
  const [testCasesPart = ''] = rest2.split('---solution---')

  const trimmed = testCasesPart.trim()
  if (!trimmed) return []

  return yaml.load(trimmed) as TestCase[]
}

// Find the track for a given problem slug by scanning the problems directory
function findTrackForProblem(problemSlug: string): string | null {
  try {
    const tracks = fs.readdirSync(PROBLEMS_DIR)
    for (const track of tracks) {
      const trackPath = path.join(PROBLEMS_DIR, track)
      if (!fs.statSync(trackPath).isDirectory()) continue
      const problems = fs.readdirSync(trackPath)
      if (problems.includes(problemSlug)) return track
    }
  } catch {
    // ignore
  }
  return null
}

async function processJob(rawPayload: string): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawPayload)
  } catch {
    console.error('[judge] Failed to parse job payload:', rawPayload)
    return
  }

  const result = JudgeJobSchema.safeParse(parsed)
  if (!result.success) {
    console.error('[judge] Invalid job payload:', result.error.message)
    return
  }

  const job = result.data
  console.log(`[judge] Processing submission ${job.submissionId} for problem ${job.problemSlug}`)

  try {
    // Mark submission as RUNNING
    await getPrisma().submission.update({
      where: { id: job.submissionId },
      data: { status: 'RUNNING' },
    })

    // Load test cases
    const trackSlug = findTrackForProblem(job.problemSlug)
    if (!trackSlug) {
      await getPrisma().submission.update({
        where: { id: job.submissionId },
        data: {
          status: 'RUNTIME_ERROR',
          errorMsg: `Problem '${job.problemSlug}' not found in problems directory`,
        },
      })
      console.log(`[judge] ${job.submissionId} written to DB`)
      return
    }

    let testCases: TestCase[]
    try {
      testCases = loadTestCases(trackSlug, job.problemSlug)
    } catch (err) {
      await getPrisma().submission.update({
        where: { id: job.submissionId },
        data: {
          status: 'RUNTIME_ERROR',
          errorMsg: `Failed to load test cases: ${err instanceof Error ? err.message : String(err)}`,
        },
      })
      console.log(`[judge] ${job.submissionId} written to DB`)
      return
    }

    if (testCases.length === 0) {
      await getPrisma().submission.update({
        where: { id: job.submissionId },
        data: {
          status: 'RUNTIME_ERROR',
          errorMsg: 'No test cases found for this problem',
        },
      })
      console.log(`[judge] ${job.submissionId} written to DB`)
      return
    }

    // Run each test case
    type FinalStatus = 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
    let finalStatus: FinalStatus = 'ACCEPTED'
    let maxRuntimeMs = 0
    let lastStdout = ''
    let firstStderr = ''

    for (const tc of testCases) {
      const sandboxResult = await runInSandbox(
        job.code,
        tc.input,
        TIMEOUT_MS,
        `${job.submissionId}-${tc.name.replace(/\s+/g, '_')}`,
      )

      if (sandboxResult.runtimeMs > maxRuntimeMs) {
        maxRuntimeMs = sandboxResult.runtimeMs
      }
      if (sandboxResult.stdout) {
        lastStdout = sandboxResult.stdout
      }
      if (sandboxResult.stderr && !firstStderr) {
        firstStderr = sandboxResult.stderr
      }

      if (sandboxResult.exitCode === 124) {
        finalStatus = 'TIME_LIMIT'
        break
      }

      if (sandboxResult.exitCode !== 0) {
        finalStatus = 'RUNTIME_ERROR'
        break
      }

      if (!verify(sandboxResult.stdout, tc.expected)) {
        finalStatus = 'WRONG_ANSWER'
        break
      }
    }

    console.log(`[judge] ${job.submissionId} → ${finalStatus} in ${maxRuntimeMs}ms`)

    // Update submission
    await getPrisma().submission.update({
      where: { id: job.submissionId },
      data: {
        status: finalStatus,
        runtimeMs: maxRuntimeMs,
        output: lastStdout || null,
        errorMsg: firstStderr || null,
      },
    })

    console.log(`[judge] ${job.submissionId} written to DB`)

    // On ACCEPTED: upsert UserProgress and award XP on first solve
    if (finalStatus === 'ACCEPTED') {
      const submission = await getPrisma().submission.findUnique({
        where: { id: job.submissionId },
        include: { problem: true },
      })

      if (submission) {
        const { userId, problem } = submission

        const existingProgress = await getPrisma().userProgress.findUnique({
          where: { userId_problemId: { userId, problemId: problem.id } },
        })

        await getPrisma().userProgress.upsert({
          where: { userId_problemId: { userId, problemId: problem.id } },
          create: {
            userId,
            problemId: problem.id,
            trackId: problem.trackId,
            attempts: 1,
          },
          update: {
            attempts: { increment: 1 },
          },
        })

        if (!existingProgress) {
          // First time solving this problem — award XP
          await getPrisma().user.update({
            where: { id: userId },
            data: { xp: { increment: problem.xpReward } },
          })
          console.log(`[judge] Awarded ${problem.xpReward} XP to user ${userId}`)
        }

        // Update streak on every accepted submission
        await updateStreak(userId)
        console.log(`[judge] Updated streak for user ${userId}`)
      }
    }
  } catch (err) {
    console.error(
      `[judge] ERROR ${job.submissionId}: ${err instanceof Error ? err.message : String(err)}`,
    )
    // Attempt to mark submission as RUNTIME_ERROR so it doesn't get stuck RUNNING
    try {
      await getPrisma().submission.update({
        where: { id: job.submissionId },
        data: {
          status: 'RUNTIME_ERROR',
          errorMsg: `Internal judge error: ${err instanceof Error ? err.message : String(err)}`,
        },
      })
    } catch {
      // best-effort — don't throw again
    }
  }
}

async function main() {
  const redisUrl = process.env.REDIS_URL!

  const redis = new Redis(redisUrl, { lazyConnect: true })
  await redis.connect()

  await getPrisma().$connect()
  console.log('[judge] Judge worker ready')
  console.log(`[judge] Problems dir: ${PROBLEMS_DIR}`)

  const shutdown = async () => {
    console.log('[judge] Shutting down...')
    redis.disconnect()
    await getPrisma().$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Main loop: blocking pop from Redis queue
  while (true) {
    try {
      const result = await redis.blpop('judge:queue', 5)
      if (!result) continue // timeout, loop again

      const [, payload] = result
      await processJob(payload)
    } catch (err) {
      console.error('[judge] Error in main loop:', err)
      // Brief pause to avoid tight error loops
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

main().catch((err) => {
  console.error('[judge] Fatal error:', err)
  process.exit(1)
})
