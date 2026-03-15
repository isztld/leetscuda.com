import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@/lib/auth'

/**
 * Context created per request. Reads the NextAuth session so procedures
 * can enforce authentication without re-fetching the session themselves.
 */
export const createContext = async () => {
  const session = await auth()
  return { session }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

/** Throws UNAUTHORIZED when called without a valid session. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})
