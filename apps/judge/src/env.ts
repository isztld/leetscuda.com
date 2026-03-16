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

const capabilities = parsed.data.JUDGE_CAPABILITIES.split(',').map((c) => c.trim()).filter(Boolean)

// If k8s capability is declared, verify kubeconform is available and offline validation works
if (capabilities.includes('k8s')) {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)
  const os = await import('os')
  const fs = await import('fs/promises')
  const path = await import('path')

  const kubeconformAvailable = await execFileAsync('kubeconform', ['-v'])
    .then(() => true)
    .catch(() => false)

  if (!kubeconformAvailable) {
    console.error('[judge] ERROR: k8s capability declared but kubeconform not found in PATH')
    process.exit(1)
  }

  try {
    const testManifest = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: test\n  namespace: default\n`
    const testFile = path.join(os.tmpdir(), `kubeconform-test-${Date.now()}.yaml`)
    await fs.writeFile(testFile, testManifest)

    await execFileAsync('kubeconform', [
      '-schema-location', 'default',
      '-summary',
      testFile,
    ])

    await fs.unlink(testFile).catch(() => {})
    console.log('[judge] kubeconform available and offline validation confirmed — k8s validation enabled')
  } catch (err) {
    console.error(`[judge] ERROR: kubeconform offline validation failed: ${err}`)
    process.exit(1)
  }
}

export const env = {
  ...parsed.data,
  capabilities,
  hostTmpDir: parsed.data.JUDGE_HOST_TMP_DIR,
  maxTimeoutMs: parseInt(parsed.data.JUDGE_MAX_TIMEOUT_MS ?? '60000'),
  maxCodeBytes: parseInt(parsed.data.JUDGE_MAX_CODE_BYTES ?? String(16 * 1024)),
}
