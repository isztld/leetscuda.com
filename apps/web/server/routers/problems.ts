import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Difficulty } from '@prisma/client'
import { router, publicProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'

export const problemsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        track: z.string().optional(),
        difficulty: z.nativeEnum(Difficulty).optional(),
        tag: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .query(({ input }) =>
      prisma.problem.findMany({
        where: {
          status: 'PUBLISHED',
          ...(input.track && { track: { slug: input.track } }),
          ...(input.difficulty && { difficulty: input.difficulty }),
          ...(input.tag && { tags: { has: input.tag } }),
          ...(input.search && {
            title: { contains: input.search, mode: 'insensitive' },
          }),
        },
        include: { track: true },
        orderBy: [{ track: { order: 'asc' } }, { difficulty: 'asc' }],
      }),
    ),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const problem = await prisma.problem.findUnique({
        where: { slug: input.slug },
        include: { track: true },
      })
      if (!problem) throw new TRPCError({ code: 'NOT_FOUND' })
      return problem
    }),

  getStats: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const problem = await prisma.problem.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      })
      if (!problem) return { totalAccepted: 0, totalSubmissions: 0, acceptanceRate: 0 }

      const [totalAccepted, totalSubmissions] = await Promise.all([
        prisma.submission.count({
          where: { problemId: problem.id, status: 'ACCEPTED' },
        }),
        prisma.submission.count({
          where: { problemId: problem.id, status: { not: 'CANCELLED' } },
        }),
      ])

      const acceptanceRate =
        totalSubmissions > 0
          ? Math.round((totalAccepted / totalSubmissions) * 1000) / 10
          : 0

      return { totalAccepted, totalSubmissions, acceptanceRate }
    }),
})
