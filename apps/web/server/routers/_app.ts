import { router } from '../trpc'
import { userRouter } from './user'
import { roadmapRouter } from './roadmap'
import { problemsRouter } from './problems'
import { submissionsRouter } from './submissions'
import { profileRouter } from './profile'

export const appRouter = router({
  user: userRouter,
  roadmap: roadmapRouter,
  problems: problemsRouter,
  submission: submissionsRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
