import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ExecutionRuntime } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { CPP_STANDARD, CUDA_VERSION, COMPUTE_CAP } from '@/lib/runtime-maps'
import { validateSubmission } from '@/lib/submission-validator'
import { SubmissionConfig } from '@/lib/submission-config'

export const submissionsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        problemSlug: z.string(),
        code: z.string().min(1).max(65536),
        language: z.enum(['cpp']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const problem = await prisma.problem.findUnique({
        where: { slug: input.problemSlug },
      })
      if (!problem) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Problem not found' })
      }

      const userId = ctx.session.user.id

      const validation = await validateSubmission({
        userId,
        problemId: problem.id,
        code: input.code,
        language: input.language,
      })

      if (!validation.valid) {
        // Observability logging for events not already logged in validator
        if (validation.code === 'PENDING_SUBMISSION') {
          console.log(`[api] DUPLICATE userId=${userId} problemId=${problem.id}`)
        } else if (validation.code === 'CODE_TOO_LARGE') {
          console.log(
            `[api] TOOLARGE userId=${userId} bytes=${Buffer.byteLength(input.code, 'utf8')}`,
          )
        }

        throw new TRPCError({
          code: validation.code === 'RATE_LIMITED' ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST',
          // Encode validation code and submissionId as JSON so the client can parse them
          message: JSON.stringify({
            code: validation.code,
            submissionId: validation.submissionId,
            message: validation.message,
          }),
        })
      }

      const submission = await prisma.submission.create({
        data: {
          userId,
          problemId: problem.id,
          code: input.code,
          language: input.language,
          status: 'PENDING',
          cppStandard: problem.cppStandard,
          cudaVersion: problem.cudaVersion,
          computeCap: problem.computeCap,
        },
      })

      console.log(
        `[api] Submission created ${submission.id} for ${input.problemSlug} by ${userId}`,
      )

      // Enqueue job to the correct queue based on execution runtime
      const isCuda = problem.executionRuntime === ExecutionRuntime.CUDA
      const cudaVerStr = problem.cudaVersion ? CUDA_VERSION[problem.cudaVersion] : '13.0'
      const queueName = isCuda ? `judge:queue:cuda:${cudaVerStr}` : 'judge:queue:cpp'

      const redis = getRedis()
      if (redis) {
        try {
          await redis.rpush(
            queueName,
            JSON.stringify({
              submissionId: submission.id,
              problemSlug: input.problemSlug,
              code: input.code,
              language: input.language,
              runtime: isCuda ? 'cuda' : 'cpp',
              cppStandard: CPP_STANDARD[problem.cppStandard],
              cudaVersion: problem.cudaVersion ? CUDA_VERSION[problem.cudaVersion] : undefined,
              computeCap: problem.computeCap ? COMPUTE_CAP[problem.computeCap] : undefined,
            }),
          )
        } catch (err) {
          console.error(
            `[api] ERROR Failed to enqueue ${submission.id}: ${err instanceof Error ? err.message : String(err)}`,
          )
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Submission created but failed to queue for judging. Please try again.',
          })
        }
      }

      return { submissionId: submission.id }
    }),

  getStatus: protectedProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await prisma.submission.findUnique({
        where: { id: input.submissionId },
      })
      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Submission not found' })
      }
      if (submission.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your submission' })
      }
      return {
        id: submission.id,
        status: submission.status,
        runtimeMs: submission.runtimeMs,
        output: submission.output,
        errorMsg: submission.errorMsg,
        submittedAt: submission.submittedAt,
      }
    }),

  /** Returns the most recent submission for the current user + problem, or null. */
  getLatestForProblem: protectedProcedure
    .input(z.object({ problemSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const problem = await prisma.problem.findUnique({
        where: { slug: input.problemSlug },
        select: { id: true },
      })
      if (!problem) return null

      const submission = await prisma.submission.findFirst({
        where: { userId: ctx.session.user.id, problemId: problem.id },
        orderBy: { submittedAt: 'desc' },
      })
      if (!submission) return null

      return {
        submissionId: submission.id,
        status: submission.status,
        runtimeMs: submission.runtimeMs,
        output: submission.output,
        errorMsg: submission.errorMsg,
      }
    }),

  /** Returns today's submission count and limit for the current user. */
  getDailyCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const [used, user] = await Promise.all([
      prisma.submission.count({ where: { userId, submittedAt: { gte: startOfDay } } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])

    const isPaid = user?.role === 'ADMIN'
    const limit = isPaid ? SubmissionConfig.dailyLimitPaid : SubmissionConfig.dailyLimitFree
    const unlimited = isPaid && limit === 0

    return { used, limit, unlimited }
  }),

  /**
   * Attempts to cancel a PENDING submission by removing it from the Redis queue.
   * Returns { cancelled: true } if successful, or { cancelled: false, currentStatus } if
   * the job was already picked up by the judge.
   */
  cancel: protectedProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await prisma.submission.findUnique({
        where: { id: input.submissionId },
        include: { problem: true },
      })

      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Submission not found' })
      }
      if (submission.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your submission' })
      }
      if (submission.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Submission cannot be cancelled — it is already ${submission.status}`,
        })
      }

      const redis = getRedis()
      if (!redis) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Queue service unavailable',
        })
      }

      // Reconstruct the exact queue name and job payload as stored by create
      const isCuda = submission.problem.executionRuntime === ExecutionRuntime.CUDA
      const cudaVerStr = submission.problem.cudaVersion
        ? CUDA_VERSION[submission.problem.cudaVersion]
        : '13.0'
      const queueName = isCuda ? `judge:queue:cuda:${cudaVerStr}` : 'judge:queue:cpp'

      const jobPayload = JSON.stringify({
        submissionId: submission.id,
        problemSlug: submission.problem.slug,
        code: submission.code,
        language: submission.language,
        runtime: isCuda ? 'cuda' : 'cpp',
        cppStandard: CPP_STANDARD[submission.problem.cppStandard],
        cudaVersion: submission.problem.cudaVersion
          ? CUDA_VERSION[submission.problem.cudaVersion]
          : undefined,
        computeCap: submission.problem.computeCap
          ? COMPUTE_CAP[submission.problem.computeCap]
          : undefined,
      })

      // LREM: atomic remove — if it returns 0 the judge already picked it up
      const removed = await redis.lrem(queueName, 1, jobPayload)

      if (removed > 0) {
        await prisma.submission.update({
          where: { id: submission.id },
          data: { status: 'CANCELLED' },
        })
        return { cancelled: true as const }
      }

      // Job was already dequeued by judge
      const current = await prisma.submission.findUnique({
        where: { id: submission.id },
        select: { status: true },
      })
      return {
        cancelled: false as const,
        currentStatus: current?.status ?? submission.status,
      }
    }),
})
