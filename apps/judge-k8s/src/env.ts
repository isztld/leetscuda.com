import { z } from 'zod'
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ─── Env schema ───────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  JUDGE_API_URL: z.string().url(),
  JUDGE_API_TOKEN: z.string().startsWith('jt_'),
  JUDGE_CAPABILITIES: z.string().min(1),
  JUDGE_MAX_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  JUDGE_MAX_MANIFEST_BYTES: z.coerce.number().int().positive().default(131_072),
  JUDGE_MAX_CHECKS: z.coerce.number().int().positive().default(64),
  JUDGE_HEALTH_PORT: z.coerce.number().int().positive().default(8081),
})

export type Env = z.infer<typeof EnvSchema>

// ─── Startup check helpers ────────────────────────────────────────────────────

function warn(msg: string): void {
  console.warn(`[judge-k8s] WARN  startup ${msg}`)
}

function info(msg: string): void {
  console.info(`[judge-k8s] INFO  startup ${msg}`)
}

/**
 * Warns if the judge process is running as root (uid 0).
 * judge-k8s has no Docker socket, so the risk is lower than judge-cuda-cpp,
 * but root is still discouraged in production.
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
 * Verifies that the `kubeconform` binary is present in PATH.
 * Runs `kubeconform -v` and exits with code 1 if the binary is not found.
 */
function checkKubeconformAvailable(): void {
  try {
    execFileSync('kubeconform', ['-v'], { encoding: 'utf8', timeout: 10_000 })
    info('kubeconform found in PATH')
  } catch {
    console.error(
      '[judge-k8s] ERROR: kubeconform not found in PATH — install it before starting',
    )
    process.exit(1)
  }
}

/**
 * Runs an offline smoke test to confirm kubeconform bundled schemas are intact.
 *
 * Writes a minimal valid ConfigMap manifest to a temp file, runs kubeconform
 * with `-schema-location default` (bundled schemas, no network), and exits
 * with code 1 if validation fails (e.g. schemas corrupt or missing).
 *
 * This is §11 step 4 of ARCHITECTURE.md.
 */
function smokeTestKubeconform(): void {
  const SMOKE_MANIFEST = `apiVersion: v1
kind: ConfigMap
metadata:
  name: smoke-test
  namespace: default
`
  const tmpFile = join(tmpdir(), `judge-k8s-smoke-${Date.now()}-${process.pid}.yaml`)

  try {
    writeFileSync(tmpFile, SMOKE_MANIFEST, { mode: 0o600 })

    execFileSync(
      'kubeconform',
      ['-strict', '-summary', '-output', 'json', '-schema-location', 'default', tmpFile],
      { encoding: 'utf8', timeout: 15_000 },
    )

    info('kubeconform offline smoke test passed — bundled schemas intact')
  } catch (err) {
    console.error(
      '[judge-k8s] ERROR: kubeconform offline smoke test failed — ' +
        'bundled schemas may be corrupt or missing.\n',
      err,
    )
    process.exit(1)
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // best-effort cleanup
    }
  }
}

// ─── loadEnv ──────────────────────────────────────────────────────────────────

/**
 * Parses process.env through the zod schema and runs all startup hardening
 * checks (§11 of ARCHITECTURE.md).
 *
 * Throws with a human-readable message on any env validation failure.
 * Exits the process on kubeconform availability or smoke-test failure.
 */
export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`[judge-k8s] Environment validation failed:\n${issues}`)
  }

  const data = parsed.data

  checkNotRoot()
  checkKubeconformAvailable()
  smokeTestKubeconform()

  return data
}
