import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  runtimeMs: number
}

// Detect if Docker is available
let dockerAvailable: boolean | null = null
async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable
  try {
    await execAsync('which docker')
    await execAsync('docker info', { timeout: 3000 })
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
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 124 : (code ?? 1),
      })
    })

    if (input) {
      child.stdin.write(input)
    }
    child.stdin.end()
  })
}

async function compileAndRunDocker(
  tmpDir: string,
  input: string,
  timeoutMs: number,
): Promise<SandboxResult> {
  // Compile inside Docker
  const compileResult = await runProcess(
    'docker',
    [
      'run', '--rm',
      '--network', 'none',
      '--memory', '256m',
      '--cpus', '0.5',
      '--ulimit', 'nproc=64',
      '-v', `${tmpDir}:/work`,
      '-w', '/work',
      'gcc:latest',
      'g++', '-O2', '-o', 'solution', 'solution.cpp',
    ],
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

  // Run inside Docker
  const start = Date.now()
  const runResult = await runProcess(
    'docker',
    [
      'run', '--rm',
      '--network', 'none',
      '--memory', '256m',
      '--cpus', '0.5',
      '--ulimit', 'nproc=64',
      '--stop-timeout', String(Math.ceil(timeoutMs / 1000)),
      '-i',
      '-v', `${tmpDir}:/work`,
      '-w', '/work',
      'gcc:latest',
      './solution',
    ],
    input,
    timeoutMs,
  )
  const runtimeMs = Date.now() - start

  return {
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    exitCode: runResult.exitCode,
    runtimeMs,
  }
}

async function compileAndRunDirect(
  tmpDir: string,
  input: string,
  timeoutMs: number,
): Promise<SandboxResult> {
  // Compile directly
  const solutionBin = path.join(tmpDir, 'solution')
  const solutionSrc = path.join(tmpDir, 'solution.cpp')

  const compileResult = await runProcess(
    'g++',
    ['-O2', '-o', solutionBin, solutionSrc],
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

  const start = Date.now()
  const runResult = await runProcess(solutionBin, [], input, timeoutMs)
  const runtimeMs = Date.now() - start

  return {
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    exitCode: runResult.exitCode,
    runtimeMs,
  }
}

export async function runInSandbox(
  code: string,
  input: string,
  timeoutMs: number,
  submissionId: string,
): Promise<SandboxResult> {
  const tmpBase = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'tmp',
  )
  const tmpDir = path.join(tmpBase, submissionId)

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'solution.cpp'), code, 'utf8')

    const useDocker = await isDockerAvailable()

    if (useDocker) {
      return await compileAndRunDocker(tmpDir, input, timeoutMs)
    } else {
      return await compileAndRunDirect(tmpDir, input, timeoutMs)
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}
