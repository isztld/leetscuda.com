import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

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

      const submission = await prisma.submission.create({
        data: {
          userId: ctx.session.user.id,
          problemId: problem.id,
          code: input.code,
          language: input.language,
          status: 'PENDING',
        },
      })

      // Enqueue job for judge worker (Phase 6)
      const redis = getRedis()
      if (redis) {
        await redis.rpush(
          'judge:queue',
          JSON.stringify({
            submissionId: submission.id,
            problemSlug: input.problemSlug,
            code: input.code,
            language: input.language,
          }),
        )
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
})
