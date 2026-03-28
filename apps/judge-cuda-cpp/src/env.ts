import { z } from 'zod'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Capability parsing ───────────────────────────────────────────────────────

export type Capability =
  | { kind: 'cpp' }
  | { kind: 'cuda'; cudaVersion: string; computeCap: string }

/**
 * Parses the JUDGE_CAPABILITIES comma-separated string into structured objects.
 *
 * Accepted formats:
 *   "cpp"                     → { kind: 'cpp' }
 *   "cuda:13.0:sm_120"        → { kind: 'cuda', cudaVersion: '13.0', computeCap: 'sm_120' }
 */
export function parseCapabilities(raw: string): Capability[] {
  return raw.split(',').map((token) => {
    const part = token.trim()
    if (part === 'cpp') return { kind: 'cpp' as const }

    const cudaMatch = part.match(/^cuda:([^:]+):([^:]+)$/)
    if (cudaMatch) {
      return {
        kind: 'cuda' as const,
        cudaVersion: cudaMatch[1]!,
        computeCap: cudaMatch[2]!,
      }
    }

    throw new Error(
      `Invalid capability token "${part}". ` +
        `Expected "cpp" or "cuda:<version>:<computeCap>" (e.g. "cuda:13.0:sm_120").`,
    )
  })
}

// ─── Env schema ───────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  JUDGE_API_URL: z.string().url(),
  JUDGE_API_TOKEN: z.string().startsWith('jt_'),
  JUDGE_CAPABILITIES: z.string().min(1),
  JUDGE_MAX_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  JUDGE_MAX_CODE_BYTES: z.coerce.number().int().positive().default(16_384),
  JUDGE_HEALTH_PORT: z.coerce.number().int().positive().default(8080),
  JUDGE_GPU_DEVICE: z.coerce.number().int().nonnegative().default(0),
  DOCKER_HOST: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema> & { capabilities: Capability[] }

// ─── Startup validation ───────────────────────────────────────────────────────

const SECCOMP_DIR = '/etc/judge/seccomp'
const SECCOMP_PROFILES = ['cpp.json', 'cuda.json'] as const

function warn(msg: string): void {
  console.warn(`[judge] WARN  startup ${msg}`)
}

function info(msg: string): void {
  console.info(`[judge] INFO  startup ${msg}`)
}

/**
 * Checks that seccomp profile files exist.
 * Logs warnings for missing profiles; does not throw (allows dev without profiles).
 */
function checkSeccompProfiles(): void {
  for (const profile of SECCOMP_PROFILES) {
    const profilePath = resolve(SECCOMP_DIR, profile)
    if (!existsSync(profilePath)) {
      warn(
        `seccomp profile missing: ${profilePath} — ` +
          `sandbox will run WITHOUT syscall filtering. Do not use in production.`,
      )
    } else {
      info(`seccomp profile ok: ${profilePath}`)
    }
  }
}

/**
 * Warns if the judge is running as root.
 * Sandbox containers always enforce --user 65534:65534 regardless, but the
 * judge process itself should not run as root.
 */
function checkNotRoot(): void {
  if (process.getuid?.() === 0) {
    warn(
      `judge process is running as root (uid 0). ` +
        `Run as an unprivileged user in production.`,
    )
  }
}

/**
 * Warns if DOCKER_HOST is unset (direct socket fallback is only safe in dev).
 */
function checkDockerHost(dockerHost: string | undefined): void {
  if (!dockerHost) {
    warn(
      `DOCKER_HOST is not set — judge will connect to the raw Docker socket. ` +
        `Configure a docker-socket-proxy sidecar in production.`,
    )
  } else {
    info(`DOCKER_HOST=${dockerHost}`)
  }
}

/**
 * Runs nvidia-smi to verify the reported compute capability matches the
 * declared cuda capability. Logs the result; does not throw on mismatch
 * (operator verification only).
 */
function verifyCudaCapability(cap: Extract<Capability, { kind: 'cuda' }>): void {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=compute_cap --format=csv,noheader',
      { encoding: 'utf8', timeout: 10_000 },
    ).trim()

    const reported = output.split('\n')[0]?.trim() ?? '(unknown)'
    const declared = cap.computeCap.replace(/^sm_/, '').replace(/(\d)(\d+)$/, '$1.$2')

    info(
      `nvidia-smi compute_cap=${reported}  declared=${cap.computeCap} ` +
        `(cuda version declared: ${cap.cudaVersion})`,
    )

    if (reported !== declared) {
      warn(
        `nvidia-smi reports compute_cap=${reported} but JUDGE_CAPABILITIES ` +
          `declares ${cap.computeCap} (normalised: ${declared}). ` +
          `Verify your JUDGE_CAPABILITIES setting.`,
      )
    }
  } catch {
    warn(
      `nvidia-smi not available or failed — cannot verify CUDA compute capability. ` +
        `Ensure NVIDIA Container Toolkit is installed for CUDA jobs.`,
    )
  }
}

/**
 * Parses process.env through the zod schema, attaches parsed capabilities,
 * and runs all startup hardening checks (§9 of ARCHITECTURE).
 *
 * Throws with a human-readable message on any validation failure.
 */
export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`[judge] Environment validation failed:\n${issues}`)
  }

  const data = parsed.data
  const capabilities = parseCapabilities(data.JUDGE_CAPABILITIES)

  // Startup hardening checks
  checkNotRoot()
  checkDockerHost(data.DOCKER_HOST)
  checkSeccompProfiles()

  for (const cap of capabilities) {
    if (cap.kind === 'cuda') {
      verifyCudaCapability(cap)
    }
  }

  return { ...data, capabilities }
}
