import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'

export const profileRouter = router({
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          image: true,
          role: true,
          xp: true,
          streakDays: true,
          createdAt: true,
        },
      })
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      const [progress, totalSubmissions, acceptedCount, recentSubmissions, tracks] =
        await Promise.all([
          prisma.userProgress.findMany({
            where: { userId: user.id },
            include: {
              problem: {
                select: {
                  slug: true,
                  title: true,
                  difficulty: true,
                  xpReward: true,
                  track: { select: { title: true, color: true } },
                },
              },
            },
            orderBy: { solvedAt: 'desc' },
          }),
          prisma.submission.count({ where: { userId: user.id } }),
          prisma.submission.count({ where: { userId: user.id, status: 'ACCEPTED' } }),
          prisma.submission.findMany({
            where: { userId: user.id },
            include: { problem: { select: { slug: true, title: true } } },
            orderBy: { submittedAt: 'desc' },
            take: 10,
          }),
          prisma.track.findMany({
            include: {
              problems: { where: { status: 'PUBLISHED' }, select: { id: true } },
            },
            orderBy: { order: 'asc' },
          }),
        ])

      // Compute difficulty breakdown
      const solvedByDifficulty = { easy: 0, medium: 0, hard: 0 }
      for (const p of progress) {
        if (p.problem.difficulty === 'EASY') solvedByDifficulty.easy++
        else if (p.problem.difficulty === 'MEDIUM') solvedByDifficulty.medium++
        else if (p.problem.difficulty === 'HARD') solvedByDifficulty.hard++
      }

      // Compute track progress
      const solvedByTrackMap = new Map<string, number>()
      for (const p of progress) {
        solvedByTrackMap.set(p.trackId, (solvedByTrackMap.get(p.trackId) ?? 0) + 1)
      }
      const solvedByTrack = tracks
        .filter((t) => t.problems.length > 0)
        .map((t) => ({
          trackSlug: t.slug,
          trackTitle: t.title,
          color: t.color,
          solved: solvedByTrackMap.get(t.id) ?? 0,
          total: t.problems.length,
        }))

      const acceptanceRate =
        totalSubmissions > 0
          ? Math.round((acceptedCount / totalSubmissions) * 100)
          : 0

      return {
        user: {
          username: user.username!,
          avatarUrl: user.avatarUrl ?? user.image,
          role: user.role,
          xp: user.xp,
          streakDays: user.streakDays,
          createdAt: user.createdAt,
        },
        stats: {
          totalSolved: progress.length,
          solvedByDifficulty,
          solvedByTrack,
          totalSubmissions,
          acceptanceRate,
        },
        recentSubmissions: recentSubmissions.map((s) => ({
          id: s.id,
          problemSlug: s.problem.slug,
          problemTitle: s.problem.title,
          status: s.status,
          runtimeMs: s.runtimeMs,
          submittedAt: s.submittedAt,
        })),
        solvedProblems: progress.map((p) => ({
          slug: p.problem.slug,
          title: p.problem.title,
          difficulty: p.problem.difficulty,
          trackTitle: p.problem.track.title,
          trackColor: p.problem.track.color,
          solvedAt: p.solvedAt,
          xpReward: p.problem.xpReward,
        })),
      }
    }),
})
