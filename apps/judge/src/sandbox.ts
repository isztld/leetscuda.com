import { spawn, execSync, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import fsAsync from 'fs/promises'
import path from 'path'
import os from 'os'
import { performance } from 'perf_hooks'
import { fileURLToPath } from 'url'
import type { CudaCapability } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)

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

const SECCOMP_CPP  = '/etc/judge/seccomp-judge.json'
const SECCOMP_CUDA = '/etc/judge/seccomp-judge-cuda.json'

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function verifyDockerProxy(): Promise<void> {
  const dockerHost = process.env.DOCKER_HOST
  if (!dockerHost) {
    console.log('[judge] WARNING: DOCKER_HOST not set — using default socket (less secure)')
    return
  }
  console.log(`[judge] Docker host: ${dockerHost}`)

  try {
    await execFileAsync('docker', ['ps', '--format', '{{.ID}}', '--filter', 'label=leetscuda-judge'])
    console.log('[judge] Docker proxy connection: OK')
  } catch (err) {
    console.log(`[judge] ERROR: Cannot connect to Docker host ${dockerHost}: ${err}`)
    process.exit(1)
  }
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
  code: string,
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
  const containerName = `lc-judge-${opts.submissionId}`
  const memoryLimit = isCuda ? '512m' : '256m'

  // Build compile + run script executed inside the container
  const compileCmd = isCuda
    ? `nvcc -std=c++${opts.cppStandard} -arch=${computeArch} -O2 -o /sandbox/solution /sandbox/${srcFile}`
    : `g++ -std=c++${opts.cppStandard} -O2 -o /sandbox/solution /sandbox/${srcFile}`
  const execScript = `set -e && ${compileCmd} && /sandbox/solution < /sandbox/input.txt`

  // Determine seccomp profile — skip flag if profile file is absent (dev environment)
  const seccompProfile = isCuda ? SECCOMP_CUDA : SECCOMP_CPP
  const seccompExists = await fsAsync.access(seccompProfile).then(() => true).catch(() => false)

  // Build docker create args
  const createArgs: string[] = [
    'create',
    '--name', containerName,
    '--network', 'none',
    '--memory', memoryLimit,
    '--cpus', '0.5',
    '--pids-limit', '64',
    '--user', '65534:65534',
    '--read-only',
    '--tmpfs', '/tmp:size=64m,mode=1777',
    '--tmpfs', '/sandbox:size=32m,mode=0777',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true',
    '--label', 'leetscuda-judge=1',
    '--workdir', '/sandbox',
  ]

  if (seccompExists) {
    createArgs.push('--security-opt', `seccomp=${seccompProfile}`)
  }

  if (isCuda) {
    createArgs.push('--cap-add', 'SYS_PTRACE')
    createArgs.push('--gpus', 'device=0')
  }

  createArgs.push(image, '/bin/sh', '-c', execScript)

  const tempCodePath  = path.join(os.tmpdir(), `${opts.submissionId}-source`)
  const tempInputPath = path.join(os.tmpdir(), `${opts.submissionId}-input`)

  try {
    // Step 1: Create container (stopped)
    await execFileAsync('docker', createArgs)

    // Step 2: Copy source code into container tmpfs — no host directory mount
    await fsAsync.writeFile(tempCodePath, code, 'utf8')
    await execFileAsync('docker', ['cp', tempCodePath, `${containerName}:/sandbox/${srcFile}`])
    await fsAsync.unlink(tempCodePath)

    await fsAsync.writeFile(tempInputPath, input, 'utf8')
    await execFileAsync('docker', ['cp', tempInputPath, `${containerName}:/sandbox/input.txt`])
    await fsAsync.unlink(tempInputPath)

    // Step 3: Start container
    const startTime = performance.now()
    await execFileAsync('docker', ['start', containerName])

    // Step 4: Wait for exit (with timeout)
    const raceResult = await Promise.race([
      execFileAsync('docker', ['wait', containerName]).then((r) => ({
        tag: 'done' as const,
        exitCode: parseInt(r.stdout.trim(), 10),
      })),
      sleep(opts.timeoutMs).then(() => ({ tag: 'timeout' as const })),
    ])

    const runtimeMs = Math.round(performance.now() - startTime)

    if (raceResult.tag === 'timeout') {
      console.log(`[judge] TIMEOUT ${opts.submissionId} — SIGTERM sent, waiting 5s`)
      try {
        await execFileAsync('docker', ['stop', '--time', '5', containerName])
      } catch {
        // container may have already exited
      }
      return { stdout: '', stderr: '', exitCode: 124, runtimeMs, timedOut: true }
    }

    const exitCode = raceResult.exitCode

    // Step 5: Capture output
    const logsResult = await execFileAsync('docker', ['logs', containerName])

    return {
      stdout: logsResult.stdout,
      stderr: logsResult.stderr,
      exitCode,
      runtimeMs,
      timedOut: false,
    }
  } finally {
    // Step 6: Always clean up container and any remaining temp files
    await execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {})
    await fsAsync.unlink(tempCodePath).catch(() => {})
    await fsAsync.unlink(tempInputPath).catch(() => {})
  }
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
  if (isDockerAvailable()) {
    const result = await runDocker(code, input, opts)
    return {
      ...result,
      stdout: sanitizeOutput(result.stdout),
      stderr: sanitizeOutput(result.stderr),
    }
  }

  // Direct execution fallback (local dev / no Docker)
  const tmpBase = path.join(__dirname, '..', 'tmp')
  const tmpDir = path.join(tmpBase, opts.submissionId)
  const isCuda = opts.runtime === 'cuda'
  const srcFile = isCuda ? 'solution.cu' : 'solution.cpp'

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(path.join(tmpDir, srcFile), code, 'utf8')

    const result = await runDirect(tmpDir, input, opts)
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
