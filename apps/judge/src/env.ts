import { z } from 'zod'

const envSchema = z.object({
  JUDGE_API_URL: z.string().url('JUDGE_API_URL must be a valid URL'),
  JUDGE_API_TOKEN: z.string().min(1, 'JUDGE_API_TOKEN is required').startsWith('jt_', 'JUDGE_API_TOKEN must start with jt_'),
  JUDGE_CAPABILITIES: z.string().min(1, 'JUDGE_CAPABILITIES is required'),
  // When the judge runs inside Docker using the host Docker socket (DinD-style),
  // volume mounts must reference host-side paths, not container-internal paths.
  // Set this to the host path that maps to the judge container's tmp directory.
  JUDGE_HOST_TMP_DIR: z.string().optional(),
  // Hard ceiling on execution timeout — job payloads cannot exceed this.
  JUDGE_MAX_TIMEOUT_MS: z.string().optional(),
  // Hard ceiling on code payload size — job payloads cannot exceed this.
  JUDGE_MAX_CODE_BYTES: z.string().optional(),
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
  hostTmpDir: parsed.data.JUDGE_HOST_TMP_DIR,
  maxTimeoutMs: parseInt(parsed.data.JUDGE_MAX_TIMEOUT_MS ?? '60000'),
  maxCodeBytes: parseInt(parsed.data.JUDGE_MAX_CODE_BYTES ?? String(16 * 1024)),
}
