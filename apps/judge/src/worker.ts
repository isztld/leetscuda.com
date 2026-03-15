import 'dotenv/config'
import './env.js'
import { pollForJob, submitResult } from './api-client.js'
import { runInSandbox } from './sandbox.js'
import { verify } from './verifier.js'
import type { JudgeJob, JudgeResult } from './types.js'
import { env } from './env.js'

async function runJob(job: JudgeJob): Promise<JudgeResult> {
  type FinalStatus = 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  let finalStatus: FinalStatus = 'ACCEPTED'
  let maxRuntimeMs = 0
  let lastStdout = ''
  let firstStderr = ''

  for (const tc of job.testCases) {
    const sandboxResult = await runInSandbox(job.code, tc.input, {
      runtime: job.runtime,
      cppStandard: job.cppStandard,
      cudaVersion: job.cudaVersion,
      computeCap: job.computeCap,
      timeoutMs: job.timeoutMs,
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
