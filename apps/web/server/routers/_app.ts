import { router } from '../trpc'

export const appRouter = router({
  // Routers for problems, submissions, users, etc. are added in Phase 2+
})

export type AppRouter = typeof appRouter
