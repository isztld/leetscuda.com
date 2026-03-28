/**
 * index.ts — sandbox orchestrator (§6, §13.3)
 *
 * runInSandbox(code, input, opts)
 *   Orchestrates the two-phase Docker sandbox (build → eval).  Falls back to
 *   runDirect() if Docker is unavailable, but only in dev — a loud WARNING is
 *   printed on every invocation in that mode.
 *
 *   All stdout/stderr returned from this function has been sanitized.
 */

import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { writeFile, unlink, chmod } from 'node:fs/promises'
import { join } from 'node:path'

import { runBuildContainer } from './build.js'
import { runEvalContainer } from './eval.js'
import { sanitizeOutput } from './sanitize.js'

const execFileAsync = promisify(execFile)

/** Spawns a process, writes `input` to its stdin, and resolves with its output. */
function spawnWithInput(
  file: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill('SIGKILL')
        resolve({ stdout, stderr, exitCode: 124, timedOut: true })
      }
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    child.on('close', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 1, timedOut: false })
      }
    })

    child.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: 1, timedOut: false })
        void err
      }
    })

    child.stdin.end(input, 'utf8')
  })
}

export interface SandboxOpts {
  submissionId: string
  tcIdx: number
  runtime: 'cpp' | 'cuda'
  cppStandard: '14' | '17' | '20' | '23'
  /** Effective timeout in ms; must already be clamped by JUDGE_MAX_TIMEOUT_MS. */
  timeoutMs: number
  /** Docker image used for the build container (must contain the compiler). */
  buildImage: string
  /** Docker image used for the eval container (minimal runtime, no compiler). */
  evalImage: string
  /** GPU device index for CUDA eval containers. */
  gpuDevice: number
  /** Per-stream output cap in bytes; defaults to 64 KiB. */
  maxOutputBytes?: number
}

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  /** Compiler stderr, present when compilation failed. */
  buildStderr?: string
  /** True if the direct (non-Docker) fallback was used. */
  usedDirectFallback: boolean
}

// ─── Docker availability detection ───────────────────────────────────────────

/**
 * Returns true if the error looks like Docker is unreachable (as opposed to a
 * container-level error like OOM or non-zero exit, which are normal outcomes).
 */
function isDockerUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return (
    msg.includes('Cannot connect to the Docker daemon') ||
    msg.includes('ECONNREFUSED') ||
    // Unix socket missing (dev without daemon)
    msg.includes('no such file or directory') ||
    msg.includes('No such file or directory') ||
    msg.includes('docker: not found') ||
    msg.includes('command not found')
  )
}

// ─── Direct execution fallback (§13.3) ───────────────────────────────────────

/**
 * Compiles and runs user code directly on the host with no container
 * isolation.  ONLY for local development — never use in production.
 */
async function runDirect(
  code: string,
  input: string,
  opts: Pick<SandboxOpts, 'runtime' | 'cppStandard' | 'timeoutMs'>,
): Promise<Omit<SandboxResult, 'usedDirectFallback'>> {
  const { runtime, cppStandard, timeoutMs } = opts

  const ext     = runtime === 'cuda' ? 'cu' : 'cpp'
  const srcFile = join(tmpdir(), `lc-direct-src-${randomUUID()}.${ext}`)
  const binFile = join(tmpdir(), `lc-direct-bin-${randomUUID()}`)

  const compiler = runtime === 'cuda' ? 'nvcc' : 'g++'

  try {
    await writeFile(srcFile, code, 'utf8')

    // Compile
    let buildStderr = ''
    try {
      const result = await execFileAsync(compiler, [
        `-std=c++${cppStandard}`, '-O2', '-o', binFile, srcFile,
      ], { encoding: 'utf8' })
      buildStderr = result.stderr
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string }
      const stderr = (e.stderr ?? e.message ?? String(err))
      return {
        stdout: '',
        stderr: '',
        exitCode: (e as any).code ?? 1,
        timedOut: false,
        buildStderr: stderr,
      }
    }

    // Make binary executable
    await chmod(binFile, 0o755)

    // Run with input piped to stdin
    const { stdout, stderr, exitCode, timedOut } = await spawnWithInput(
      binFile,
      [],
      input,
      timeoutMs,
    )

    return { stdout, stderr, exitCode, timedOut, buildStderr }
  } finally {
    await unlink(srcFile).catch(() => undefined)
    await unlink(binFile).catch(() => undefined)
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Runs `code` against `input` in the two-phase Docker sandbox and returns
 * sanitized stdout/stderr.
 *
 * Falls back to runDirect() if Docker is unavailable, printing a prominent
 * WARNING on each invocation (§13.3).
 */
export async function runInSandbox(
  code: string,
  input: string,
  opts: SandboxOpts,
): Promise<SandboxResult> {
  const {
    submissionId, tcIdx, runtime, cppStandard,
    timeoutMs, buildImage, evalImage, gpuDevice, maxOutputBytes,
  } = opts

  try {
    // ── Phase 1: compile ─────────────────────────────────────────────────
    const buildResult = await runBuildContainer(code, {
      submissionId,
      tcIdx,
      runtime,
      cppStandard,
      buildImage,
    })

    if (buildResult.binary === null) {
      // Compilation failed or timed out — return immediately, no eval phase.
      return {
        stdout: '',
        stderr: sanitizeOutput(buildResult.stderr),
        exitCode: buildResult.exitCode,
        timedOut: buildResult.timedOut,
        buildStderr: sanitizeOutput(buildResult.stderr),
        usedDirectFallback: false,
      }
    }

    // ── Phase 2: evaluate ────────────────────────────────────────────────
    const evalResult = await runEvalContainer(buildResult.binary, input, {
      submissionId,
      tcIdx,
      runtime,
      timeoutMs,
      evalImage,
      gpuDevice,
      maxOutputBytes,
    })

    // §7.6 — warn after every CUDA job that GPU memory is not cleared.
    if (runtime === 'cuda') {
      console.warn(
        '[judge] WARN  gpu:memory GPU memory not cleared — ' +
          'potential data leakage between submissions (see §7.6)',
      )
    }

    return {
      stdout:             sanitizeOutput(evalResult.stdout),
      stderr:             sanitizeOutput(evalResult.stderr),
      exitCode:           evalResult.exitCode,
      timedOut:           evalResult.timedOut,
      buildStderr:        sanitizeOutput(buildResult.stderr),
      usedDirectFallback: false,
    }
  } catch (err) {
    if (!isDockerUnavailable(err)) {
      // Not a connectivity issue — re-throw so the caller can handle it.
      throw err
    }

    // ── Docker unavailable — direct fallback (dev only, §13.3) ───────────
    console.warn(
      '\n' +
      '╔══════════════════════════════════════════════════════════════════╗\n' +
      '║  WARNING: running in DIRECT mode — no sandbox isolation         ║\n' +
      '║  Docker is unreachable. User code runs directly on the host.    ║\n' +
      '║  NEVER use this in production.                                  ║\n' +
      '╚══════════════════════════════════════════════════════════════════╝\n',
    )

    const directResult = await runDirect(code, input, { runtime, cppStandard, timeoutMs })

    return {
      stdout:             sanitizeOutput(directResult.stdout),
      stderr:             sanitizeOutput(directResult.stderr),
      exitCode:           directResult.exitCode,
      timedOut:           directResult.timedOut,
      buildStderr:        directResult.buildStderr !== undefined
                            ? sanitizeOutput(directResult.buildStderr)
                            : undefined,
      usedDirectFallback: true,
    }
  }
}
