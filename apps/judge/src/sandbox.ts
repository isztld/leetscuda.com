import { spawn } from 'child_process'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface SandboxOptions {
  runtime: 'cpp' | 'cuda'
  cppStandard: '14' | '17' | '20' | '23'
  cudaVersion?: string
  computeCap?: string
  timeoutMs: number
  submissionId: string
}

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  runtimeMs: number
}

const DOCKER_IMAGES: Record<string, string> = {
  cpp: 'gcc:14',
  'cuda:13.0': 'nvidia/cuda:13.0.0-devel-ubuntu24.04',
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

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

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
  const imageKey = isCuda ? `cuda:${opts.cudaVersion ?? '13.0'}` : 'cpp'
  const image = DOCKER_IMAGES[imageKey] ?? DOCKER_IMAGES['cpp']
  const srcFile = isCuda ? 'solution.cu' : 'solution.cpp'
  const computeArch = opts.computeCap ?? 'sm_86'

  const compileCmd = isCuda
    ? ['nvcc', `-std=c++${opts.cppStandard}`, `-arch=${computeArch}`, '-O2', '-o', 'solution', srcFile]
    : ['g++', `-std=c++${opts.cppStandard}`, '-O2', '-o', 'solution', srcFile]

  const dockerBaseArgs = isCuda
    ? ['run', '--rm', '--network', 'none', '--memory', '512m', '--gpus', 'device=0', '--ulimit', 'nproc=128']
    : ['run', '--rm', '--network', 'none', '--memory', '256m', '--cpus', '0.5', '--ulimit', 'nproc=64']

  // When running inside Docker with the host Docker socket, volume mounts must use
  // the host-side path. JUDGE_HOST_TMP_DIR maps the container's tmp dir to its host path.
  const hostTmpDir = env.hostTmpDir
    ? path.join(env.hostTmpDir, opts.submissionId)
    : tmpDir

  // Compile
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

  // Run — use --entrypoint to bypass the CUDA container's banner-printing entrypoint script
  const start = Date.now()
  const runResult = await runProcess(
    'docker',
    [...dockerBaseArgs, '--entrypoint', '/work/solution', '--stop-timeout', String(Math.ceil(opts.timeoutMs / 1000)), '-i', '-v', `${hostTmpDir}:/work`, '-w', '/work', image],
    input,
    opts.timeoutMs,
  )
  const runtimeMs = Date.now() - start

  return { stdout: runResult.stdout, stderr: runResult.stderr, exitCode: runResult.exitCode, runtimeMs }
}

async function runDirect(
  tmpDir: string,
  input: string,
  opts: SandboxOptions,
): Promise<SandboxResult> {
  const isCuda = opts.runtime === 'cuda'
  // Use absolute source path so nvcc's internal cc1plus subprocess can find the file
  // regardless of what CWD nvcc uses when it spawns subprocesses.
  // Also pass cwd=tmpDir so nvcc can resolve its own relative temp-file references.
  const srcFile = path.join(tmpDir, isCuda ? 'solution.cu' : 'solution.cpp')
  const binFile = path.join(tmpDir, 'solution')

  const compileArgs = isCuda
    ? ['nvcc', `-std=c++${opts.cppStandard}`, `-arch=${opts.computeCap ?? 'sm_86'}`, '-O2', '-o', binFile, srcFile]
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

    if (isDockerAvailable()) {
      return await runDocker(tmpDir, input, opts)
    } else {
      return await runDirect(tmpDir, input, opts)
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}
