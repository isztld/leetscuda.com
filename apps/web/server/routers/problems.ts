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
})
