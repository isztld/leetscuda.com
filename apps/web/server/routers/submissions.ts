import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ExecutionRuntime } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { CPP_STANDARD, CUDA_VERSION, COMPUTE_CAP } from '@/lib/runtime-maps'

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
          cppStandard: problem.cppStandard,
          cudaVersion: problem.cudaVersion,
          computeCap: problem.computeCap,
        },
      })

      console.log(
        `[api] Submission created ${submission.id} for ${input.problemSlug} by ${ctx.session.user.id}`,
      )

      // Enqueue job to the correct queue based on execution runtime
      const isCuda = problem.executionRuntime === ExecutionRuntime.CUDA
      const cudaVerStr = problem.cudaVersion ? CUDA_VERSION[problem.cudaVersion] : '12.6'
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
})
