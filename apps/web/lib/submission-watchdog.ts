import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

const RUNNING_TIMEOUT_MS  = parseInt(process.env.SUBMISSION_RUNNING_TIMEOUT_MS ?? '300000')  // 5 min
const PENDING_TIMEOUT_MS  = parseInt(process.env.SUBMISSION_PENDING_TIMEOUT_MS ?? '600000')  // 10 min
export const WATCHDOG_INTERVAL_MS = 60_000

function dailyKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `submission:daily:${userId}:${today}`
}

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`)
}

export async function runSubmissionWatchdog(): Promise<void> {
  const now = new Date()
  const redis = getRedis()

  // Find submissions stuck in RUNNING too long — judge crashed mid-execution
  const stuckRunning = await prisma.submission.findMany({
    where: {
      status: 'RUNNING',
      submittedAt: { lt: new Date(now.getTime() - RUNNING_TIMEOUT_MS) },
    },
  })

  for (const submission of stuckRunning) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'RUNTIME_ERROR',
        errorMsg: 'Judge became unavailable during evaluation. Please resubmit.',
      },
    })

    // Refund the daily submission count
    if (redis && submission.userId) {
      const key = dailyKey(submission.userId)
      const current = await redis.get(key)
      if (current && parseInt(current, 10) > 0) {
        await redis.decr(key)
      }
    }

    log(`[watchdog] Marked stuck RUNNING submission ${submission.id} as RUNTIME_ERROR (refunded daily count)`)
  }

  // Find submissions stuck in PENDING too long — queue may be dead or no judge available
  const stuckPending = await prisma.submission.findMany({
    where: {
      status: 'PENDING',
      submittedAt: { lt: new Date(now.getTime() - PENDING_TIMEOUT_MS) },
    },
  })

  for (const submission of stuckPending) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'RUNTIME_ERROR',
        errorMsg: 'No judge available to process this submission. Please resubmit when the judge is back online.',
      },
    })

    // Refund the daily submission count
    if (redis && submission.userId) {
      const key = dailyKey(submission.userId)
      const current = await redis.get(key)
      if (current && parseInt(current, 10) > 0) {
        await redis.decr(key)
      }
    }

    log(`[watchdog] Marked stuck PENDING submission ${submission.id} as RUNTIME_ERROR (refunded daily count)`)
  }

  if (stuckRunning.length + stuckPending.length > 0) {
    log(
      `[watchdog] Cleaned up ${stuckRunning.length} stuck RUNNING + ${stuckPending.length} stuck PENDING submissions`,
    )
  }
}
