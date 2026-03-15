import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateJudge } from '@/lib/judge-auth'
import { prisma } from '@/lib/prisma'
import { updateStreak } from '@/lib/streak'

const ResultSchema = z.object({
  submissionId: z.string(),
  status: z.enum(['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT']),
  runtimeMs: z.number().int().nonnegative(),
  output: z.string().optional(),
  errorMsg: z.string().optional(),
  cppStandard: z.string().optional(),
  cudaVersion: z.string().optional(),
  computeCap: z.string().optional(),
})

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const judge = await authenticateJudge(req)
  if (!judge) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 })
  }

  const result = parsed.data

  // 3. Update submission with runtime metadata recorded from what the judge actually used
  await prisma.submission.update({
    where: { id: result.submissionId },
    data: {
      status: result.status,
      runtimeMs: result.runtimeMs,
      output: result.output ?? null,
      errorMsg: result.errorMsg ?? null,
      cppStandard: result.cppStandard,
      cudaVersion: result.cudaVersion,
      computeCap: result.computeCap,
    },
  })

  console.log(`[judge-result] ${result.submissionId} → ${result.status} in ${result.runtimeMs}ms (judge: ${judge.name})`)

  // 4. On ACCEPTED: award XP on first solve, update streak
  if (result.status === 'ACCEPTED') {
    const submission = await prisma.submission.findUnique({
      where: { id: result.submissionId },
      include: { problem: true },
    })

    if (submission) {
      const { userId, problem } = submission

      const existingProgress = await prisma.userProgress.findUnique({
        where: { userId_problemId: { userId, problemId: problem.id } },
      })

      await prisma.userProgress.upsert({
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
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: problem.xpReward } },
        })
        console.log(`[judge-result] Awarded ${problem.xpReward} XP to user ${userId}`)
      }

      await updateStreak(userId)
    }
  }

  return NextResponse.json({ ok: true })
}
