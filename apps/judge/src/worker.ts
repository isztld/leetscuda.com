import 'dotenv/config'
import './env.js'
import { execSync } from 'child_process'
import { pollForJob, submitResult, recoverStuckSubmissions } from './api-client.js'
import { runInSandbox, verifyDockerProxy } from './sandbox.js'
import { verify } from './verifier.js'
import { validateK8sManifest } from './k8s-validator.js'
import type { CppJudgeJob, JudgeResult, SubmissionTestResult } from './types.js'
import { env } from './env.js'
import type { CudaCapability } from './env.js'

async function clearGpuMemory(): Promise<void> {
  // A proper implementation would run a trivial CUDA kernel that mallocs and zeros a large
  // buffer to evict the previous job's GPU memory. This is a known limitation of GPU sandboxing
  // that even commercial platforms do not fully solve; MIG (A100/H100) provides hardware isolation.
  console.log('[judge] WARNING: GPU memory not cleared between jobs — potential data leakage between submissions')
}

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

async function runCppJob(job: CppJudgeJob): Promise<JudgeResult> {
  // Clamp timeout to the hard ceiling — never trust the payload blindly
  const effectiveTimeout = Math.min(job.timeoutMs ?? env.maxTimeoutMs, env.maxTimeoutMs)

  // Resolve judge's own CUDA capability from env — used for image selection and -arch= flag
  const cudaCap = env.parsedCapabilities.find((c) => c.runtime === 'cuda') as CudaCapability | undefined

  type FinalStatus = 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  let finalStatus: FinalStatus = 'ACCEPTED'
  let maxRuntimeMs = 0
  let firstStderr = ''
  const testResults: SubmissionTestResult[] = []

  for (let tcIdx = 0; tcIdx < job.testCases.length; tcIdx++) {
    const tc = job.testCases[tcIdx]
    const sandboxResult = await runInSandbox(job.code + '\n' + job.harness, tc.input, {
      runtime: job.runtime,
      cppStandard: job.cppStandard,
      judgeComputeCap: cudaCap?.computeCap,
      judgeCudaVersion: cudaCap?.version,
      timeoutMs: effectiveTimeout,
      submissionId: `${job.submissionId}-${tcIdx}`,
    })

    if (sandboxResult.runtimeMs > maxRuntimeMs) maxRuntimeMs = sandboxResult.runtimeMs
    if (sandboxResult.stderr && !firstStderr) firstStderr = sandboxResult.stderr

    if (sandboxResult.exitCode === 124) {
      finalStatus = 'TIME_LIMIT'
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: sandboxResult.stdout?.trim() ?? '',
        runtimeMs: sandboxResult.runtimeMs,
      })
      break
    }
    if (sandboxResult.exitCode !== 0) {
      finalStatus = 'RUNTIME_ERROR'
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: sandboxResult.stderr?.trim() ?? '',
        runtimeMs: sandboxResult.runtimeMs,
      })
      break
    }
    const passed = verify(sandboxResult.stdout, tc.expected)
    testResults.push({
      index: tcIdx,
      passed,
      input: tc.input,
      expected: tc.expected,
      actual: sandboxResult.stdout?.trim() ?? '',
      runtimeMs: sandboxResult.runtimeMs,
    })
    if (!passed) {
      finalStatus = 'WRONG_ANSWER'
      break
    }
  }

  return {
    submissionId: job.submissionId,
    status: finalStatus,
    runtimeMs: maxRuntimeMs,
    errorMsg: firstStderr || undefined,
    testResults,
    cppStandard: job.cppStandard,
  }
}

async function main() {
  console.log('[judge] Judge worker ready')
  console.log(`[judge] Capabilities: ${env.capabilities.join(', ')}`)
  console.log(`[judge] API URL: ${env.JUDGE_API_URL}`)

  // Verify Docker proxy / socket connectivity (only relevant for cpp/cuda judges)
  if (env.parsedCapabilities.some((c) => c.runtime === 'cpp' || c.runtime === 'cuda')) {
    await verifyDockerProxy()
    await cleanupOrphanedContainers()
  }

  // Mark any submissions left RUNNING from the previous crash as RUNTIME_ERROR
  const recovered = await recoverStuckSubmissions()
  if (recovered > 0) {
    console.log(`[judge] Startup recovery: marked ${recovered} stuck RUNNING submission(s) as RUNTIME_ERROR`)
  }

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
          errorMsg: 'Code payload exceeds maximum allowed size',
        })
        continue
      }

      if (job.runtime === 'k8s') {
        console.log(`[judge] Processing ${job.submissionId} — k8s (${job.k8sChecks.length} checks)`)
        const effectiveTimeout = Math.min(job.timeoutMs ?? env.maxTimeoutMs, env.maxTimeoutMs)

        const results = await validateK8sManifest(job.code, job.k8sChecks, {
          multiDoc: job.k8sMultiDoc,
          timeoutMs: effectiveTimeout,
        })

        const allPassed = results.every((r) => r.passed)
        const status = allPassed ? 'ACCEPTED' : 'WRONG_ANSWER'
        const firstFailed = results.find((r) => !r.passed)

        await submitResult({
          submissionId: job.submissionId,
          status,
          runtimeMs: 0,
          errorMsg: firstFailed?.message ?? undefined,
          testResults: results.map((r, i) => ({
            index: i,
            passed: r.passed,
            input: r.checkId,       // checkId stored in input field
            expected: r.description,
            actual: r.message,
            runtimeMs: 0,
          })),
        })

        console.log(`[judge] ${job.submissionId} → ${status} (${results.filter((r) => r.passed).length}/${results.length} checks passed)`)
        continue
      }

      console.log(`[judge] Processing ${job.submissionId} — ${job.runtime} c++${job.cppStandard}`)
      const result = await runCppJob(job)
      await submitResult(result)
      console.log(`[judge] ${job.submissionId} → ${result.status} in ${result.runtimeMs}ms`)

      if (job.runtime === 'cuda') {
        await clearGpuMemory()
      }
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
