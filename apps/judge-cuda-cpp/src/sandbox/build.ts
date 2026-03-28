/**
 * build.ts — Phase 1 compile container lifecycle (§6.1, §7.2)
 *
 * runBuildContainer(code, opts)
 *   Creates a short-lived Docker container that compiles user code into a
 *   static binary, extracts the binary via docker cp, then removes the
 *   container.  Returns { binary, stderr, exitCode, timedOut }.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const execFileAsync = promisify(execFile)

/** Fixed compile timeout per §6.6 */
const COMPILE_TIMEOUT_MS = 30_000

/** Seccomp profiles live here (bind-mounted read-only in the judge container) */
const SECCOMP_DIR = '/etc/judge/seccomp'

export interface BuildOpts {
  submissionId: string
  tcIdx: number
  runtime: 'cpp' | 'cuda'
  cppStandard: '14' | '17' | '20' | '23'
  /** Pre-pulled image that contains the compiler (e.g. gcc:14, leetscuda-cuda-sandbox:13.0) */
  buildImage: string
}

export interface BuildResult {
  /** Compiled binary, or null on compile failure / timeout. */
  binary: Buffer | null
  /** Compiler stderr (diagnostics). */
  stderr: string
  exitCode: number
  timedOut: boolean
}

async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', args, {
    encoding: 'utf8',
    // Generous buffer — individual log lines from the compiler can be large.
    maxBuffer: 10 * 1024 * 1024,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Compiles `code` inside a Docker container and returns the resulting binary.
 *
 * Container flags match §7.2 exactly.  Temp source/binary files on the host
 * are written to os.tmpdir() and deleted in a finally block (§6.5).
 */
export async function runBuildContainer(
  code: string,
  opts: BuildOpts,
): Promise<BuildResult> {
  const { submissionId, tcIdx, runtime, cppStandard, buildImage } = opts

  const containerName = `lc-build-${submissionId}-${tcIdx}`
  const ext = runtime === 'cuda' ? 'cu' : 'cpp'

  // Temp files on the host — deleted in the outer finally block.
  const srcFile = join(tmpdir(), `lc-src-${randomUUID()}.${ext}`)
  const binFile = join(tmpdir(), `lc-bin-${randomUUID()}`)

  // Compile command executed inside the container.
  const compileCmd =
    runtime === 'cuda'
      ? `nvcc -std=c++${cppStandard} -O2 -o /sandbox/solution /sandbox/solution.cu`
      : `g++ -std=c++${cppStandard} -O2 -o /sandbox/solution /sandbox/solution.cpp`

  // §7.4 — no dedicated build seccomp profile is defined; skip seccomp for
  // the build phase rather than mis-applying the eval profile (the compiler
  // needs a broader syscall set than a running binary).
  // If a build profile is later added at <SECCOMP_DIR>/build.json it will be
  // picked up here automatically.
  const seccompArgs: string[] = []
  const buildSeccomp = join(SECCOMP_DIR, 'build.json')
  if (existsSync(buildSeccomp)) {
    seccompArgs.push('--security-opt', `seccomp=${buildSeccomp}`)
  } else {
    console.warn(
      `[judge] WARN  sandbox:build-seccomp no build seccomp profile at ${buildSeccomp} — ` +
        'build container will run without syscall filtering',
    )
  }

  // docker create arguments (§7.2)
  const createArgs = [
    'create',
    '--name',          containerName,
    '--network',       'none',
    '--memory',        '512m',
    '--cpus',          '1.0',
    '--pids-limit',    '128',
    '--user',          '65534:65534',
    '--cap-drop',      'ALL',
    '--security-opt',  'no-new-privileges:true',
    ...seccompArgs,
    '--tmpfs',         '/sandbox:size=64m,mode=0777',
    '--tmpfs',         '/tmp:size=64m,mode=1777',
    '--label',         'leetscuda-judge=1',
    '--label',         'leetscuda-phase=build',
    buildImage,
    '/bin/sh', '-c', compileCmd,
  ]

  // Write code to a host temp file first so we can docker cp it in.
  await writeFile(srcFile, code, 'utf8')

  let containerCreated = false

  try {
    // ── Phase 1: create container ──────────────────────────────────────────
    await docker(createArgs)
    containerCreated = true
    console.info(
      `[judge] INFO  sandbox:build-start submissionId=${submissionId} tcIdx=${tcIdx} ` +
        `container=${containerName}`,
    )

    // ── Phase 2: inject source file (§6.5) ────────────────────────────────
    await docker(['cp', srcFile, `${containerName}:/sandbox/solution.${ext}`])

    // Temp source file no longer needed on the host.
    await unlink(srcFile).catch(() => undefined)

    // ── Phase 3: start ────────────────────────────────────────────────────
    await docker(['start', containerName])

    // ── Phase 4: wait with 30 s compile timeout (§6.6) ────────────────────
    type WaitOutcome =
      | { kind: 'done'; exitCode: number }
      | { kind: 'timeout' }

    const outcome = await Promise.race<WaitOutcome>([
      docker(['wait', containerName]).then(({ stdout }) => {
        const code = parseInt(stdout.trim(), 10)
        return { kind: 'done', exitCode: Number.isFinite(code) ? code : 1 }
      }),
      sleep(COMPILE_TIMEOUT_MS).then(() => ({ kind: 'timeout' as const })),
    ])

    if (outcome.kind === 'timeout') {
      // SIGTERM → 5 s grace → SIGKILL
      await docker(['stop', '--time', '5', containerName]).catch(() => undefined)
      const stderr = await captureStderr(containerName)
      console.warn(
        `[judge] WARN  sandbox:build-timeout submissionId=${submissionId} tcIdx=${tcIdx}`,
      )
      return { binary: null, stderr: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1000}s\n${stderr}`, exitCode: 1, timedOut: true }
    }

    const { exitCode } = outcome

    // ── Phase 5: capture compiler diagnostics ────────────────────────────
    const stderr = await captureStderr(containerName)

    if (exitCode !== 0) {
      console.warn(
        `[judge] WARN  sandbox:build-error submissionId=${submissionId} ` +
          `tcIdx=${tcIdx} exitCode=${exitCode}`,
      )
      return { binary: null, stderr, exitCode, timedOut: false }
    }

    // ── Phase 6: extract binary via docker cp (§6.5) ────────────────────
    await docker(['cp', `${containerName}:/sandbox/solution`, binFile])
    const binary = await readFile(binFile)

    return { binary, stderr, exitCode, timedOut: false }
  } finally {
    // Always remove the container (§6.5).
    if (containerCreated) {
      await docker(['rm', '-f', containerName]).catch(() => undefined)
    }
    // Clean up host temp files.
    await unlink(srcFile).catch(() => undefined)
    await unlink(binFile).catch(() => undefined)
  }
}

/** Captures stderr from docker logs for a stopped/exited container. */
async function captureStderr(containerName: string): Promise<string> {
  try {
    const { stderr } = await docker(['logs', containerName])
    return stderr
  } catch {
    return ''
  }
}
