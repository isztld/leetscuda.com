import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        image: true,
        xp: true,
        streakDays: true,
        role: true,
      },
    })
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' })
    return user
  }),

  setUsername: protectedProcedure
    .input(
      z.object({
        username: z
          .string()
          .regex(USERNAME_RE, '3–20 characters, letters, numbers, and underscores only'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      })
      if (existing && existing.id !== ctx.session.user.id) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username is already taken' })
      }
      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { username: input.username },
      })
      return { username: input.username }
    }),
})
