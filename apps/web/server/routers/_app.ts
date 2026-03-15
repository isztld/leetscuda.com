import { router } from '../trpc'
import { userRouter } from './user'
import { roadmapRouter } from './roadmap'
import { problemsRouter } from './problems'

export const appRouter = router({
  user: userRouter,
  roadmap: roadmapRouter,
  problems: problemsRouter,
})

export type AppRouter = typeof appRouter
