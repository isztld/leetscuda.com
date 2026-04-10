import { z } from 'zod'

// Critical: must be present for the app to start.
const criticalSchema = z.object({
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  AUTH_URL: z.string().url('AUTH_URL must be a valid URL'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
})

// OAuth: required for sign-in; warn (not throw) if absent so local dev works.
const oauthSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
})

// Skip validation during `next build` so CI without injected secrets can
// still produce a build artifact. Validation runs on every actual startup.
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  const critical = criticalSchema.safeParse(process.env)
  if (!critical.success) {
    const lines = critical.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Missing required environment variables:\n${lines.join('\n')}`)
  }

  const oauth = oauthSchema.safeParse(process.env)
  if (!oauth.success) {
    const missing = oauth.error.issues.map((i) => i.path.join('.')).join(', ')
    console.warn(`[env] OAuth credentials missing (${missing}) — sign-in will be unavailable`)
  }
}
