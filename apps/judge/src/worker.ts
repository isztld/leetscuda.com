import 'dotenv/config'
import './env.js'
import { execSync } from 'child_process'
import { pollForJob, submitResult } from './api-client.js'
import { runInSandbox } from './sandbox.js'
import { verify } from './verifier.js'
import type { JudgeJob, JudgeResult } from './types.js'
import { env } from './env.js'

/** Kill any containers from a previous crashed judge session before starting. */
async function cleanupOrphanedContainers(): Promise<void> {
  try {
    const ids = execSync(
      'docker ps --filter label=leetscuda-judge --filter status=running -q',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()

    if (!ids) return

    const containerIds = ids.split('\n').filter(Boolean)
    console.log(`[judge] CLEANUP found ${containerIds.length} orphaned containers, stopping`)
    for (const id of containerIds) {
      try {
        execSync(`docker stop --time 1 ${id}`, { stdio: 'ignore' })
      } catch {
        // best-effort
      }
    }
  } catch {
    // Docker not available or no containers — ignore
  }
}

async function runJob(job: JudgeJob): Promise<JudgeResult> {
  // Clamp timeout to the hard ceiling — never trust the payload blindly
  const effectiveTimeout = Math.min(job.timeoutMs ?? env.maxTimeoutMs, env.maxTimeoutMs)

  type FinalStatus = 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  let finalStatus: FinalStatus = 'ACCEPTED'
  let maxRuntimeMs = 0
  let lastStdout = ''
  let firstStderr = ''

  for (const tc of job.testCases) {
    const sandboxResult = await runInSandbox(job.code + '\n' + job.harness, tc.input, {
      runtime: job.runtime,
      cppStandard: job.cppStandard,
      cudaVersion: job.cudaVersion,
      computeCap: job.computeCap,
      timeoutMs: effectiveTimeout,
      submissionId: `${job.submissionId}-${job.testCases.indexOf(tc)}`,
    })

    if (sandboxResult.runtimeMs > maxRuntimeMs) maxRuntimeMs = sandboxResult.runtimeMs
    if (sandboxResult.stdout) lastStdout = sandboxResult.stdout
    if (sandboxResult.stderr && !firstStderr) firstStderr = sandboxResult.stderr

    if (sandboxResult.exitCode === 124) {
      finalStatus = 'TIME_LIMIT'
      break
    }
    if (sandboxResult.exitCode !== 0) {
      finalStatus = 'RUNTIME_ERROR'
      break
    }
    if (!verify(sandboxResult.stdout, tc.expected)) {
      finalStatus = 'WRONG_ANSWER'
      break
    }
  }

  return {
    submissionId: job.submissionId,
    status: finalStatus,
    runtimeMs: maxRuntimeMs,
    output: lastStdout || undefined,
    errorMsg: firstStderr || undefined,
    cppStandard: job.cppStandard,
    cudaVersion: job.cudaVersion,
    computeCap: job.computeCap,
  }
}

async function main() {
  console.log('[judge] Judge worker ready')
  console.log(`[judge] Capabilities: ${env.capabilities.join(', ')}`)
  console.log(`[judge] API URL: ${env.JUDGE_API_URL}`)

  // Kill orphaned containers from any previous crash
  await cleanupOrphanedContainers()

  process.on('SIGINT', () => {
    console.log('[judge] Shutting down...')
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    console.log('[judge] Shutting down...')
    process.exit(0)
  })

  while (true) {
    try {
      const job = await pollForJob()
      if (!job) continue

      // Secondary code size guard — never trust the payload blindly
      const codeBytes = Buffer.byteLength(job.code, 'utf8')
      if (codeBytes > env.maxCodeBytes) {
        console.log(`[judge] OVERSIZED ${job.submissionId} — rejected before sandbox`)
        await submitResult({
          submissionId: job.submissionId,
          status: 'RUNTIME_ERROR',
          runtimeMs: 0,
          output: '',
          errorMsg: 'Code payload exceeds maximum allowed size',
        })
        continue
      }

      console.log(`[judge] Processing ${job.submissionId} — ${job.runtime} c++${job.cppStandard}`)
      const result = await runJob(job)
      await submitResult(result)
      console.log(`[judge] ${job.submissionId} → ${result.status} in ${result.runtimeMs}ms`)
    } catch (err) {
      console.error('[judge] Error in main loop:', err)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

main().catch((err) => {
  console.error('[judge] Fatal error:', err)
  process.exit(1)
})
