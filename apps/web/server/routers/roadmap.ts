import { router, publicProcedure, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'

export const roadmapRouter = router({
  getTracks: publicProcedure.query(() =>
    prisma.track.findMany({
      orderBy: { order: 'asc' },
      include: { roadmapNodes: { orderBy: { order: 'asc' } } },
    }),
  ),

  getUserProgress: protectedProcedure.query(async ({ ctx }) => {
    const progress = await prisma.userProgress.findMany({
      where: { userId: ctx.session.user.id },
      include: { problem: { select: { slug: true } } },
    })
    return progress.map((p) => p.problem.slug)
  }),
})
