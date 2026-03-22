import { spawn } from 'child_process'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.js'
import type { CudaCapability } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface SandboxOptions {
  runtime: 'cpp' | 'cuda'
  cppStandard: '14' | '17' | '20' | '23'
  judgeComputeCap?: string   // judge's actual SM, e.g. "sm_120" — used for -arch= flag
  judgeCudaVersion?: string  // judge's actual CUDA version, e.g. "13.0" — used to select image
  timeoutMs: number
  submissionId: string
}

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  runtimeMs: number
  timedOut?: boolean
}

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KB per stream

// Strip ANSI escape sequences and non-printable characters (except \n, \r, \t)
function sanitizeOutput(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // ANSI CSI sequences
    .replace(/\x1b[^[]/g, '')               // other ESC sequences
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '') // keep tab, LF, CR, printable ASCII
}

const CUDA_IMAGES: Record<string, string> = {
  '13.0': 'nvidia/cuda:13.0.0-devel-ubuntu24.04',
  '12.6': 'nvidia/cuda:12.6.0-devel-ubuntu22.04',
}

function getDockerImage(runtime: 'cpp' | 'cuda', cudaCapability?: CudaCapability): string {
  if (runtime === 'cpp') return 'gcc:14'
  if (runtime === 'cuda' && cudaCapability) {
    const image = CUDA_IMAGES[cudaCapability.version]
    if (!image) throw new Error(`No Docker image configured for CUDA ${cudaCapability.version}`)
    return image
  }
  throw new Error(`Cannot determine Docker image for runtime: ${runtime}`)
}

// Detect if Docker is available (cached after first check)
let dockerAvailable: boolean | null = null
function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) return dockerAvailable
  try {
    execSync('which docker', { stdio: 'ignore' })
    execSync('docker info', { stdio: 'ignore', timeout: 3000 })
    dockerAvailable = true
  } catch {
    dockerAvailable = false
  }
  return dockerAvailable
}

async function runProcess(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (d: Buffer) => {
      if (Buffer.byteLength(stdout, 'utf8') < MAX_OUTPUT_BYTES) {
        stdout += d.toString()
        if (Buffer.byteLength(stdout, 'utf8') >= MAX_OUTPUT_BYTES) {
          stdout = stdout.slice(0, MAX_OUTPUT_BYTES) + '\n[output truncated]'
          child.kill('SIGKILL')
        }
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      if (Buffer.byteLength(stderr, 'utf8') < MAX_OUTPUT_BYTES) {
        stderr += d.toString()
        if (Buffer.byteLength(stderr, 'utf8') >= MAX_OUTPUT_BYTES) {
          stderr = stderr.slice(0, MAX_OUTPUT_BYTES) + '\n[output truncated]'
        }
      }
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: timedOut ? 124 : (code ?? 1) })
    })

    if (input) child.stdin.write(input)
    child.stdin.end()
  })
}

async function runDocker(
  tmpDir: string,
  input: string,
  opts: SandboxOptions,
): Promise<SandboxResult> {
  const isCuda = opts.runtime === 'cuda'
  const cudaCap: CudaCapability | undefined = isCuda && opts.judgeCudaVersion
    ? { runtime: 'cuda', version: opts.judgeCudaVersion, computeCap: opts.judgeComputeCap ?? 'sm_86' }
    : undefined
  const image = getDockerImage(opts.runtime, cudaCap)
  const srcFile = isCuda ? 'solution.cu' : 'solution.cpp'
  const computeArch = opts.judgeComputeCap ?? 'sm_86'

  const compileCmd = isCuda
    ? ['nvcc', `-std=c++${opts.cppStandard}`, `-arch=${computeArch}`, '-O2', '-o', 'solution', srcFile]
    : ['g++', `-std=c++${opts.cppStandard}`, '-O2', '-o', 'solution', srcFile]

  const dockerBaseArgs = isCuda
    ? [
        'run', '--rm', '--network', 'none', '--memory', '512m',
        '--gpus', 'device=0', '--ulimit', 'nproc=128',
        '--label', 'leetscuda-judge=1',
      ]
    : [
        'run', '--rm', '--network', 'none', '--memory', '256m',
        '--cpus', '0.5', '--ulimit', 'nproc=64',
        '--label', 'leetscuda-judge=1',
      ]

  // When running inside Docker with the host Docker socket, volume mounts must use
  // the host-side path. JUDGE_HOST_TMP_DIR maps the container's tmp dir to its host path.
  const hostTmpDir = env.hostTmpDir
    ? path.join(env.hostTmpDir, opts.submissionId)
    : tmpDir

  // Compile — short-lived container, SIGKILL on 30s timeout is fine
  const compileResult = await runProcess(
    'docker',
    [...dockerBaseArgs, '-v', `${hostTmpDir}:/work`, '-w', '/work', image, ...compileCmd],
    '',
    30_000,
  )

  if (compileResult.exitCode !== 0) {
    return {
      stdout: '',
      stderr: compileResult.stderr || compileResult.stdout,
      exitCode: compileResult.exitCode,
      runtimeMs: 0,
    }
  }

  // Run — named container so we can do a two-phase SIGTERM/SIGKILL on timeout
  const containerName = `lc-judge-${opts.submissionId}`
  const runArgs = [
    ...dockerBaseArgs,
    '--name', containerName,
    '--entrypoint', '/work/solution',
    '-i',
    '-v', `${hostTmpDir}:/work`,
    '-w', '/work',
    image,
  ]

  const start = Date.now()
  // Give runProcess extra slack — we handle the real timeout externally via docker stop
  const runPromise = runProcess('docker', runArgs, input, opts.timeoutMs + 30_000)
  const timeoutP = new Promise<'TIMEOUT'>((resolve) =>
    setTimeout(() => resolve('TIMEOUT'), opts.timeoutMs),
  )

  const race = await Promise.race([
    runPromise.then((r) => ({ tag: 'done' as const, ...r })),
    timeoutP,
  ])
  const runtimeMs = Date.now() - start

  if (race === 'TIMEOUT') {
    console.log(`[judge] TIMEOUT ${opts.submissionId} — SIGTERM sent, waiting 5s`)
    try {
      // docker stop: sends SIGTERM, waits --time seconds, then sends SIGKILL if still running
      execSync(`docker stop --time 5 ${containerName}`, { stdio: 'ignore', timeout: 15_000 })
    } catch {
      // container may have already exited
    }
    // Drain the process promise to prevent unhandled rejection
    await runPromise.catch(() => {})
    return { stdout: '', stderr: '', exitCode: 124, runtimeMs, timedOut: true }
  }

  return { stdout: race.stdout, stderr: race.stderr, exitCode: race.exitCode, runtimeMs }
}

async function runDirect(
  tmpDir: string,
  input: string,
  opts: SandboxOptions,
): Promise<SandboxResult> {
  const isCuda = opts.runtime === 'cuda'
  // Use absolute source path so nvcc's internal cc1plus subprocess can find the file
  // regardless of what CWD nvcc uses when it spawns subprocesses.
  const srcFile = path.join(tmpDir, isCuda ? 'solution.cu' : 'solution.cpp')
  const binFile = path.join(tmpDir, 'solution')

  const compileArgs = isCuda
    ? ['nvcc', `-std=c++${opts.cppStandard}`, `-arch=${opts.judgeComputeCap ?? 'sm_86'}`, '-O2', '-o', binFile, srcFile]
    : ['g++', `-std=c++${opts.cppStandard}`, '-O2', '-o', binFile, srcFile]

  const compileResult = await runProcess(compileArgs[0], compileArgs.slice(1), '', 30_000, tmpDir)

  if (compileResult.exitCode !== 0) {
    return {
      stdout: '',
      stderr: compileResult.stderr || compileResult.stdout,
      exitCode: compileResult.exitCode,
      runtimeMs: 0,
    }
  }

  const start = Date.now()
  const runResult = await runProcess(binFile, [], input, opts.timeoutMs)
  const runtimeMs = Date.now() - start

  return { stdout: runResult.stdout, stderr: runResult.stderr, exitCode: runResult.exitCode, runtimeMs }
}

export async function runInSandbox(
  code: string,
  input: string,
  opts: SandboxOptions,
): Promise<SandboxResult> {
  const tmpBase = path.join(__dirname, '..', 'tmp')
  const tmpDir = path.join(tmpBase, opts.submissionId)
  const isCuda = opts.runtime === 'cuda'
  const srcFile = isCuda ? 'solution.cu' : 'solution.cpp'

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(path.join(tmpDir, srcFile), code, 'utf8')

    const result = isDockerAvailable()
      ? await runDocker(tmpDir, input, opts)
      : await runDirect(tmpDir, input, opts)

    return {
      ...result,
      stdout: sanitizeOutput(result.stdout),
      stderr: sanitizeOutput(result.stderr),
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}
