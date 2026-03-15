import { router, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const roadmapRouter = router({
  getTracks: publicProcedure.query(() =>
    prisma.track.findMany({
      orderBy: { order: 'asc' },
      include: { roadmapNodes: { orderBy: { order: 'asc' } } },
    }),
  ),

  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    const [problemProgress, conceptReads] = await Promise.all([
      prisma.userProgress.findMany({
        where: { userId: ctx.session.user.id },
        include: { problem: { select: { slug: true } } },
      }),
      prisma.conceptRead.findMany({
        where: { userId: ctx.session.user.id },
        select: { nodeSlug: true },
      }),
    ])
    return [
      ...problemProgress.map((p) => p.problem.slug),
      ...conceptReads.map((c) => c.nodeSlug),
    ]
  }),

  markConceptRead: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.conceptRead.upsert({
        where: { userId_nodeSlug: { userId: ctx.session.user.id, nodeSlug: input.slug } },
        update: {},
        create: { userId: ctx.session.user.id, nodeSlug: input.slug },
      })
    }),
})
