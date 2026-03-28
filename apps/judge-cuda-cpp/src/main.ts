/**
 * main.ts — Judge entry point (§5, §9, §10, §12)
 *
 * Runs startup checks in order (§9), starts the health server, then enters
 * the poll loop:
 *
 *   pollForJob() → secondary code-size guard → for each test case:
 *     runInSandbox() → verify() → assemble JudgeResult → submitResult()
 *
 * Early exit on TIME_LIMIT or RUNTIME_ERROR (skips remaining test cases).
 * SIGINT/SIGTERM trigger a clean shutdown after the current job finishes.
 */

import http from 'node:http'

import { loadEnv, type Env, type Capability } from './env.js'
import { init, pollForJob, submitResult, recoverStuckSubmissions } from './api-client.js'
import { verifyDockerProxy, cleanupOrphanedContainers } from './sandbox/proxy.js'
import { runInSandbox } from './sandbox/index.js'
import { verify } from './verifier.js'
import type { CppJudgeJob, JudgeResult, SubmissionStatus, SubmissionTestResult } from './types.js'

// ─── Lifecycle flags ──────────────────────────────────────────────────────────

let isReady = false
let isShuttingDown = false

// ─── Health server (§4 GET /api/judge/health) ─────────────────────────────────

/**
 * Starts a minimal HTTP server on JUDGE_HEALTH_PORT.
 *
 *   GET /  →  200  { status: "ok", capabilities: [...] }   when ready
 *          →  503  { status: "starting" | "shutdown" }      otherwise
 */
function startHealthServer(env: Env): http.Server {
  const capabilityStrings = env.capabilities.map((c: Capability) =>
    c.kind === 'cpp' ? 'cpp' : `cuda:${c.cudaVersion}:${c.computeCap}`,
  )

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || (req.url !== '/' && req.url !== '')) {
      res.writeHead(404)
      res.end()
      return
    }

    if (isReady && !isShuttingDown) {
      const body = JSON.stringify({ status: 'ok', capabilities: capabilityStrings })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    } else {
      const body = JSON.stringify({ status: isShuttingDown ? 'shutdown' : 'starting' })
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(body)
    }
  })

  server.listen(env.JUDGE_HEALTH_PORT, '0.0.0.0', () => {
    console.info(`[judge] INFO  health:listen port=${env.JUDGE_HEALTH_PORT}`)
  })

  return server
}

// ─── Image resolution ─────────────────────────────────────────────────────────

/**
 * Derives the Docker build/eval image names from the job's runtime and the
 * declared CUDA capability (when present).
 */
function resolveImages(
  job: CppJudgeJob,
  env: Env,
): { buildImage: string; evalImage: string } {
  if (job.runtime === 'cuda') {
    const cudaCap = env.capabilities.find(
      (c): c is Extract<Capability, { kind: 'cuda' }> => c.kind === 'cuda',
    )
    const cudaVersion = job.cudaMinVersion ?? cudaCap?.cudaVersion ?? '13.0'
    const img = `leetscuda-cuda-sandbox:${cudaVersion}`
    return { buildImage: img, evalImage: img }
  }
  return { buildImage: 'gcc:14', evalImage: 'gcc:14' }
}

// ─── Job processor ────────────────────────────────────────────────────────────

async function processJob(job: CppJudgeJob, env: Env): Promise<void> {
  const { submissionId, code, harness, runtime, cppStandard, testCases, timeoutMs } = job

  console.info(
    `[judge] INFO  job:received ${submissionId} runtime=${runtime} tests=${testCases.length}`,
  )

  // §10 — secondary code-size guard (defense-in-depth after web-app limits)
  const codeBytes = Buffer.byteLength(code, 'utf8')
  if (codeBytes > env.JUDGE_MAX_CODE_BYTES) {
    console.warn(
      `[judge] WARN  job:oversized ${submissionId} ` +
        `code=${codeBytes}B limit=${env.JUDGE_MAX_CODE_BYTES}B`,
    )
    await submitResult({
      submissionId,
      status: 'RUNTIME_ERROR',
      runtimeMs: 0,
      errorMsg:
        `Code size ${codeBytes} bytes exceeds the maximum allowed ` +
        `${env.JUDGE_MAX_CODE_BYTES} bytes.`,
      cppStandard,
    })
    return
  }

  // Clamp per-test-case timeout (§10)
  const effectiveTimeout = Math.min(timeoutMs, env.JUDGE_MAX_TIMEOUT_MS)

  const { buildImage, evalImage } = resolveImages(job, env)

  // Combine user code with the test harness. The harness provides main() and
  // the test driver; user code provides the solution function.
  const fullCode = `${code}\n${harness}`

  const testResults: SubmissionTestResult[] = []
  let overallStatus: SubmissionStatus = 'ACCEPTED'
  let slowestMs = 0
  let firstErrorMsg: string | undefined

  for (let tcIdx = 0; tcIdx < testCases.length; tcIdx++) {
    if (isShuttingDown) break

    const tc = testCases[tcIdx]!
    const wallStart = Date.now()

    // ── Run in sandbox ────────────────────────────────────────────────────────
    let sandboxResult: Awaited<ReturnType<typeof runInSandbox>>
    try {
      sandboxResult = await runInSandbox(fullCode, tc.input, {
        submissionId,
        tcIdx,
        runtime,
        cppStandard,
        timeoutMs: effectiveTimeout,
        buildImage,
        evalImage,
        gpuDevice: env.JUDGE_GPU_DEVICE,
      })
    } catch (err) {
      // Unexpected sandbox error (not Docker-unavailable — that case falls back
      // inside runInSandbox).
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[judge] ERROR sandbox:crash ${submissionId} tc=${tcIdx}:`, msg)
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: '',
        runtimeMs: Date.now() - wallStart,
      })
      overallStatus = 'RUNTIME_ERROR'
      firstErrorMsg = msg
      break
    }

    const tcMs = Date.now() - wallStart

    // ── Classify sandbox outcome ──────────────────────────────────────────────

    // Compile failure: build phase produced no binary and the only stderr is
    // the compiler's own diagnostics (buildStderr === stderr, stdout always '').
    const isBuildFailure =
      !sandboxResult.timedOut &&
      sandboxResult.exitCode !== 0 &&
      sandboxResult.stdout === '' &&
      sandboxResult.buildStderr !== undefined &&
      sandboxResult.buildStderr.length > 0 &&
      sandboxResult.buildStderr === sandboxResult.stderr

    if (isBuildFailure) {
      console.warn(
        `[judge] WARN  sandbox:build-error ${submissionId} tc=${tcIdx}`,
      )
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: '',
        runtimeMs: tcMs,
      })
      overallStatus = 'COMPILE_ERROR'
      firstErrorMsg = sandboxResult.buildStderr
      break
    }

    // Time-limit exceeded (eval phase or build timeout)
    if (sandboxResult.timedOut) {
      console.warn(
        `[judge] WARN  sandbox:eval-timeout ${submissionId} ` +
          `tc=${tcIdx} limit=${effectiveTimeout}ms`,
      )
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: sandboxResult.stdout,
        runtimeMs: tcMs,
      })
      overallStatus = 'TIME_LIMIT'
      firstErrorMsg = `Execution exceeded the ${effectiveTimeout} ms time limit.`
      break // §5 early exit
    }

    // Runtime error (non-zero exit after successful compile)
    if (sandboxResult.exitCode !== 0) {
      console.warn(
        `[judge] WARN  sandbox:runtime-error ${submissionId} ` +
          `tc=${tcIdx} exit=${sandboxResult.exitCode}`,
      )
      testResults.push({
        index: tcIdx,
        passed: false,
        input: tc.input,
        expected: tc.expected,
        actual: sandboxResult.stdout,
        runtimeMs: tcMs,
      })
      overallStatus = 'RUNTIME_ERROR'
      firstErrorMsg =
        sandboxResult.stderr.trim() ||
        `Process exited with code ${sandboxResult.exitCode}.`
      break // §5 early exit
    }

    // ── Successful run — verify output ────────────────────────────────────────
    console.info(
      `[judge] INFO  sandbox:eval-done ${submissionId} tc=${tcIdx} ms=${tcMs}`,
    )

    const passed = verify(sandboxResult.stdout, tc.expected)

    testResults.push({
      index: tcIdx,
      passed,
      input: tc.input,
      expected: tc.expected,
      actual: sandboxResult.stdout,
      runtimeMs: tcMs,
    })

    if (tcMs > slowestMs) slowestMs = tcMs

    // Wrong answer — record but continue to collect remaining results
    if (!passed && overallStatus === 'ACCEPTED') {
      overallStatus = 'WRONG_ANSWER'
    }
  }

  const result: JudgeResult = {
    submissionId,
    status: overallStatus,
    runtimeMs: slowestMs,
    errorMsg: firstErrorMsg,
    testResults,
    cppStandard,
  }

  await submitResult(result)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // §9 step 1 — env validation; also runs seccomp check, root check,
  // DOCKER_HOST warning, and nvidia-smi verification inside loadEnv().
  const env = loadEnv()

  // Initialise the API client with the parsed env.
  init(env)

  // Start health server immediately — serves 503 until isReady = true.
  const healthServer = startHealthServer(env)

  // §9 step 4 — Docker proxy reachability; exits with code 1 on failure.
  await verifyDockerProxy()

  // §9 step 5 — Stop any sandbox containers left by a previous crash.
  await cleanupOrphanedContainers()

  // §9 step 6 — Mark any RUNNING submissions as RUNTIME_ERROR on the web app.
  await recoverStuckSubmissions()

  // Signal that the judge is healthy and ready to accept jobs.
  isReady = true
  console.info('[judge] INFO  startup:ready poll loop starting')

  // ── Signal handlers ───────────────────────────────────────────────────────
  function onShutdown(signal: string): void {
    if (isShuttingDown) return
    console.info(
      `[judge] INFO  shutdown:signal received ${signal} — finishing current job then exiting`,
    )
    isShuttingDown = true
    isReady = false
    // Stop accepting new health-check connections; existing request finishes.
    healthServer.close()
  }

  process.once('SIGINT', () => onShutdown('SIGINT'))
  process.once('SIGTERM', () => onShutdown('SIGTERM'))

  // ── Poll loop ─────────────────────────────────────────────────────────────
  while (!isShuttingDown) {
    const job = await pollForJob()
    if (job === null) continue
    await processJob(job, env)
  }

  console.info('[judge] INFO  shutdown:complete exiting cleanly')
  process.exit(0)
}

main().catch((err) => {
  console.error('[judge] ERROR fatal:', err)
  process.exit(1)
})
