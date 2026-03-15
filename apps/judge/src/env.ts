import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  PROBLEMS_PATH: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
  throw new Error(
    `[judge] Missing or invalid required environment variables: ${missing}\n` +
      parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
  )
}

export const env = parsed.data
