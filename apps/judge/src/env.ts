import { z } from 'zod'

const envSchema = z.object({
  JUDGE_API_URL: z.string().url('JUDGE_API_URL must be a valid URL'),
  JUDGE_API_TOKEN: z.string().min(1, 'JUDGE_API_TOKEN is required').startsWith('jt_', 'JUDGE_API_TOKEN must start with jt_'),
  JUDGE_CAPABILITIES: z.string().min(1, 'JUDGE_CAPABILITIES is required'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
  throw new Error(
    `[judge] Missing or invalid required environment variables:\n${lines.join('\n')}`,
  )
}

export const env = {
  ...parsed.data,
  // Parse comma-separated capabilities, e.g. "cpp,cuda:13.0" → ["cpp", "cuda:13.0"]
  capabilities: parsed.data.JUDGE_CAPABILITIES.split(',').map((c) => c.trim()).filter(Boolean),
}
