import { NextRequest } from 'next/server'
import { authenticateJudge } from '@/lib/judge-auth'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

// POST /api/judge/recover
// Called by the judge on startup. Marks all RUNNING submissions as RUNTIME_ERROR so the
// user's browser stops polling and can resubmit. This is safe to call even if another judge
// is mid-processing — the result endpoint will overwrite with the real outcome when it posts.
export async function POST(request: NextRequest) {
  const judge = await authenticateJudge(request)
  if (!judge) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stuckSubmissions = await prisma.submission.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, userId: true, submittedAt: true },
  })

  const redis = getRedis()
  let recovered = 0

  for (const submission of stuckSubmissions) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'RUNTIME_ERROR',
        errorMsg: 'Judge restarted during evaluation. Please resubmit.',
      },
    })

    // Refund the daily submission count so the user can resubmit without penalty
    if (redis) {
      const day = submission.submittedAt.toISOString().slice(0, 10)
      const key = `submission:daily:${submission.userId}:${day}`
      const current = await redis.get(key)
      if (current && parseInt(current, 10) > 0) {
        await redis.decr(key)
      }
    }

    recovered++
  }

  if (recovered > 0) {
    console.log(`[judge-recover] ${judge.name} recovered ${recovered} stuck RUNNING submissions`)
  }

  return Response.json({ recovered })
}
