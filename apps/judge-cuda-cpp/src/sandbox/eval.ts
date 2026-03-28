/**
 * eval.ts — Phase 2 evaluation container lifecycle (§6.2, §7.3)
 *
 * runEvalContainer(binary, input, opts)
 *   Creates a short-lived Docker container that runs a pre-compiled binary
 *   against a single test-case input.  Returns { stdout, stderr, exitCode,
 *   timedOut }.  Applies a two-phase kill on timeout (§6.6).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const execFileAsync = promisify(execFile)

const SECCOMP_DIR = '/etc/judge/seccomp'

/** exit code returned when a container is killed for exceeding timeout (matches `timeout(1)` convention) */
const TIMEOUT_EXIT_CODE = 124

/** Maximum bytes captured per output stream (§6.7) */
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024

export interface EvalOpts {
  submissionId: string
  tcIdx: number
  runtime: 'cpp' | 'cuda'
  /** Wall-clock limit in ms; should already be clamped by JUDGE_MAX_TIMEOUT_MS. */
  timeoutMs: number
  /** Pre-pulled minimal runtime image (should not contain a compiler). */
  evalImage: string
  /** GPU device index for CUDA jobs; ignored for cpp (§7.5). */
  gpuDevice: number
  /** Per-stream output cap in bytes; defaults to 64 KiB (§6.7). */
  maxOutputBytes?: number
}

export interface EvalResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncate(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, 'utf8')
  if (buf.length <= maxBytes) return s
  return buf.subarray(0, maxBytes).toString('utf8') + `\n[output truncated at ${maxBytes} bytes]`
}

/**
 * Runs the pre-compiled `binary` against `input` inside a Docker container.
 *
 * Container flags match §7.3 exactly.  For CUDA jobs, --gpus and
 * --cap-add SYS_PTRACE are added (§7.5).  Seccomp profiles are loaded from
 * SECCOMP_DIR if present (§7.4).
 */
export async function runEvalContainer(
  binary: Buffer,
  input: string,
  opts: EvalOpts,
): Promise<EvalResult> {
  const { submissionId, tcIdx, runtime, timeoutMs, evalImage, gpuDevice } = opts
  const maxOutputBytes = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES

  const containerName = `lc-eval-${submissionId}-${tcIdx}`

  // Host-side temp files — deleted in the outer finally block (§6.5).
  const binFile  = join(tmpdir(), `lc-bin-${randomUUID()}`)
  const inpFile  = join(tmpdir(), `lc-inp-${randomUUID()}.txt`)

  // ── Seccomp profile (§7.4) ─────────────────────────────────────────────
  const profileName = runtime === 'cuda' ? 'cuda.json' : 'cpp.json'
  const seccompProfile = join(SECCOMP_DIR, profileName)
  const seccompArgs: string[] = existsSync(seccompProfile)
    ? ['--security-opt', `seccomp=${seccompProfile}`]
    : []

  if (!existsSync(seccompProfile)) {
    console.warn(
      `[judge] WARN  sandbox:eval-seccomp profile missing: ${seccompProfile} — ` +
        'eval container will run WITHOUT syscall filtering. Do not use in production.',
    )
  }

  // ── Memory limit depends on runtime (§7.3) ─────────────────────────────
  const memoryLimit = runtime === 'cuda' ? '512m' : '128m'

  // ── CUDA-specific flags (§7.5) ─────────────────────────────────────────
  const cudaArgs: string[] = runtime === 'cuda'
    ? ['--gpus', `device=${gpuDevice}`, '--cap-add', 'SYS_PTRACE']
    : []

  // docker create arguments (§7.3)
  const createArgs = [
    'create',
    '--name',         containerName,
    '--network',      'none',
    '--memory',       memoryLimit,
    '--cpus',         '0.5',
    '--pids-limit',   '32',
    '--user',         '65534:65534',
    '--cap-drop',     'ALL',
    '--security-opt', 'no-new-privileges:true',
    ...seccompArgs,
    ...cudaArgs,
    '--tmpfs',        '/sandbox:size=16m,mode=0777',
    '--tmpfs',        '/tmp:size=16m,mode=1777',
    '--label',        'leetscuda-judge=1',
    '--label',        'leetscuda-phase=eval',
    evalImage,
    '/bin/sh', '-c', '/sandbox/solution < /sandbox/input.txt',
  ]

  await writeFile(binFile, binary)
  await writeFile(inpFile, input, 'utf8')

  let containerCreated = false

  try {
    // ── Create container ───────────────────────────────────────────────────
    await docker(createArgs)
    containerCreated = true

    // ── Inject binary and input via docker cp (§6.5) ────────────────────
    await docker(['cp', binFile, `${containerName}:/sandbox/solution`])
    await docker(['cp', inpFile, `${containerName}:/sandbox/input.txt`])

    // Temp files no longer needed on the host after the cp.
    await unlink(binFile).catch(() => undefined)
    await unlink(inpFile).catch(() => undefined)

    // ── Start ────────────────────────────────────────────────────────────
    await docker(['start', containerName])

    // ── Wait with timeout — two-phase kill on expiry (§6.6) ─────────────
    type WaitOutcome =
      | { kind: 'done'; exitCode: number }
      | { kind: 'timeout' }

    const outcome = await Promise.race<WaitOutcome>([
      docker(['wait', containerName]).then(({ stdout }) => {
        const code = parseInt(stdout.trim(), 10)
        return { kind: 'done', exitCode: Number.isFinite(code) ? code : 1 }
      }),
      sleep(timeoutMs).then(() => ({ kind: 'timeout' as const })),
    ])

    let exitCode: number
    let timedOut: boolean

    if (outcome.kind === 'timeout') {
      // SIGTERM → 5 s grace → SIGKILL (§6.6)
      await docker(['stop', '--time', '5', containerName]).catch(() => undefined)
      exitCode = TIMEOUT_EXIT_CODE
      timedOut = true
      console.warn(
        `[judge] WARN  sandbox:eval-timeout submissionId=${submissionId} ` +
          `tcIdx=${tcIdx} timeoutMs=${timeoutMs}`,
      )
    } else {
      exitCode = outcome.exitCode
      timedOut = false
    }

    // ── Capture output (§6.7) ────────────────────────────────────────────
    let stdout = ''
    let stderr = ''
    try {
      const logs = await docker(['logs', containerName])
      stdout = truncate(logs.stdout, maxOutputBytes)
      stderr = truncate(logs.stderr, maxOutputBytes)
    } catch {
      // If logs fail we still return what we have.
    }

    if (!timedOut) {
      console.info(
        `[judge] INFO  sandbox:eval-done submissionId=${submissionId} ` +
          `tcIdx=${tcIdx} exitCode=${exitCode}`,
      )
    }

    return { stdout, stderr, exitCode, timedOut }
  } finally {
    // Always remove the container — overlay changes are discarded (§6.5).
    if (containerCreated) {
      await docker(['rm', '-f', containerName]).catch(() => undefined)
    }
    // Clean up any host temp files that weren't deleted earlier.
    await unlink(binFile).catch(() => undefined)
    await unlink(inpFile).catch(() => undefined)
  }
}
