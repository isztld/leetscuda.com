import { router } from '../trpc'
import { userRouter } from './user'
import { roadmapRouter } from './roadmap'

export const appRouter = router({
  user: userRouter,
  roadmap: roadmapRouter,
})

export type AppRouter = typeof appRouter
