import { z } from 'zod'

// ── Capability types ──────────────────────────────────────────────────────────

export type CppCapability  = { runtime: 'cpp' }
export type CudaCapability = { runtime: 'cuda'; version: string; computeCap: string }
export type K8sCapability  = { runtime: 'k8s' }
export type JudgeCapability = CppCapability | CudaCapability | K8sCapability

export function parseCapabilities(raw: string): JudgeCapability[] {
  return raw.split(',').map((cap) => {
    const parts = cap.trim().split(':')
    if (parts[0] === 'cpp') return { runtime: 'cpp' as const }
    if (parts[0] === 'k8s') return { runtime: 'k8s' as const }
    if (parts[0] === 'cuda' && parts.length === 3) {
      return { runtime: 'cuda' as const, version: parts[1], computeCap: parts[2] }
    }
    throw new Error(`[judge] Invalid capability string: "${cap}". Expected format: cpp | cuda:{version}:{sm_cap} | k8s`)
  })
}

// ── Env schema ────────────────────────────────────────────────────────────────

const envSchema = z.object({
  JUDGE_API_URL: z.string().url('JUDGE_API_URL must be a valid URL'),
  JUDGE_API_TOKEN: z.string().min(1, 'JUDGE_API_TOKEN is required').startsWith('jt_', 'JUDGE_API_TOKEN must start with jt_'),
  JUDGE_CAPABILITIES: z.string().min(1, 'JUDGE_CAPABILITIES is required'),
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
const parsedCapabilities = parseCapabilities(parsed.data.JUDGE_CAPABILITIES)

// ── Startup validation ────────────────────────────────────────────────────────

// Security configuration checks
{
  const fs = await import('fs/promises')

  const cppProfile  = '/etc/judge/seccomp-judge.json'
  const cudaProfile = '/etc/judge/seccomp-judge-cuda.json'

  await fs.access(cppProfile)
    .then(() => console.log('[judge] Seccomp profile (cpp): found'))
    .catch(() => console.log('[judge] WARNING: Seccomp profile not found at ' + cppProfile + ' — running without syscall filtering'))

  await fs.access(cudaProfile)
    .then(() => console.log('[judge] Seccomp profile (cuda): found'))
    .catch(() => console.log('[judge] WARNING: Seccomp profile not found at ' + cudaProfile + ' — CUDA containers will run without syscall filtering'))

  const uid = process.getuid?.()
  if (uid === 0) {
    console.log('[judge] WARNING: Judge process is running as root — sandbox containers will also start as root unless --user is set')
  }

  if (!process.env.DOCKER_HOST) {
    console.log('[judge] WARNING: DOCKER_HOST not set — judge has direct Docker socket access (less secure)')
    console.log('[judge] Recommended: use docker-compose.judge.yml with docker-socket-proxy')
  } else {
    console.log(`[judge] Docker host (proxy): ${process.env.DOCKER_HOST}`)
  }
}

// If k8s capability is declared, verify kubeconform is available and offline validation works
if (parsedCapabilities.some((c) => c.runtime === 'k8s')) {
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

// If cuda capability is declared, log it and optionally verify GPU sm via nvidia-smi
for (const cap of parsedCapabilities) {
  if (cap.runtime === 'cuda') {
    console.log(`[judge] CUDA capability: version=${cap.version} computeCap=${cap.computeCap}`)
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)
    try {
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=compute_cap',
        '--format=csv,noheader',
      ])
      // nvidia-smi returns e.g. "12.0" — convert to sm_120
      const reportedRaw = stdout.trim().split('\n')[0].trim().replace('.', '')
      console.log(`[judge] GPU reports compute capability: sm_${reportedRaw} (declared: ${cap.computeCap})`)
    } catch {
      console.log('[judge] WARNING: nvidia-smi not available — cannot verify GPU compute capability')
    }
  }
}

export const env = {
  ...parsed.data,
  capabilities,
  parsedCapabilities,
  maxTimeoutMs: parseInt(parsed.data.JUDGE_MAX_TIMEOUT_MS ?? '60000'),
  maxCodeBytes: parseInt(parsed.data.JUDGE_MAX_CODE_BYTES ?? String(16 * 1024)),
}
