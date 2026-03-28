/**
 * Entry point for judge-k8s.
 *
 * Startup sequence (§11):
 *   1. loadEnv()  — env validation + kubeconform availability + smoke test
 *   2. init()     — inject env into api-client
 *   3. root check — already done inside loadEnv()
 *   4. recover    — mark stuck RUNNING submissions as RUNTIME_ERROR
 *   5. health server — listens on JUDGE_HEALTH_PORT
 *   6. poll loop  — continuously poll for jobs and validate
 *
 * Signal handling: SIGINT / SIGTERM set a shutdown flag; the loop drains
 * after the current job finishes.
 */

import { createServer } from 'node:http'
import { loadEnv } from './env.js'
import { init, pollForJob, submitResult, recoverStuckSubmissions } from './api-client.js'
import { validateK8sManifest, TooManyChecksError } from './validator/index.js'
import type { JudgeResult, K8sValidationResult } from './types.js'

// ─── Startup ──────────────────────────────────────────────────────────────────

const env = loadEnv()
init(env)

// ─── Health server ────────────────────────────────────────────────────────────

const healthPayload = JSON.stringify({ status: 'ok', capabilities: ['k8s'] })

const healthServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(healthPayload)
})

healthServer.listen(env.JUDGE_HEALTH_PORT, '127.0.0.1', () => {
  console.info(
    `[judge-k8s] INFO  startup:health server listening on 127.0.0.1:${env.JUDGE_HEALTH_PORT}`,
  )
})

// ─── Shutdown flag ────────────────────────────────────────────────────────────

let shuttingDown = false

function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  console.info(`[judge-k8s] INFO  startup received ${signal} — finishing current job then exiting`)
  healthServer.close()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// ─── Stuck submission recovery ────────────────────────────────────────────────

await recoverStuckSubmissions()

console.info('[judge-k8s] INFO  startup:ready poll loop started')

// ─── Poll loop ────────────────────────────────────────────────────────────────

while (!shuttingDown) {
  const job = await pollForJob()

  if (job === null) {
    // pollForJob already slept on backoff/429; loop immediately
    continue
  }

  console.info(
    `[judge-k8s] INFO  job:received submissionId=${job.submissionId} problemSlug=${job.problemSlug} checks=${job.k8sChecks.length}`,
  )

  // ── Code-size guard ─────────────────────────────────────────────────────────
  const codeBytes = Buffer.byteLength(job.code, 'utf8')
  if (codeBytes > env.JUDGE_MAX_MANIFEST_BYTES) {
    console.warn(
      `[judge-k8s] WARN  job:oversized submissionId=${job.submissionId} ` +
        `size=${codeBytes} limit=${env.JUDGE_MAX_MANIFEST_BYTES}`,
    )
    await submitResult({
      submissionId: job.submissionId,
      status: 'RUNTIME_ERROR',
      runtimeMs: 0,
      errorMsg: `Manifest too large: ${codeBytes} bytes exceeds ${env.JUDGE_MAX_MANIFEST_BYTES}-byte limit`,
    })
    continue
  }

  // ── Max-checks guard + validation ───────────────────────────────────────────
  let validationResults: K8sValidationResult[]

  try {
    const timeoutMs = Math.min(job.timeoutMs, env.JUDGE_MAX_TIMEOUT_MS)

    validationResults = await validateK8sManifest(job.code, job.k8sChecks, {
      multiDoc: job.k8sMultiDoc,
      maxBytes: env.JUDGE_MAX_MANIFEST_BYTES,
      maxChecks: env.JUDGE_MAX_CHECKS,
      timeoutMs,
    })
  } catch (err) {
    if (err instanceof TooManyChecksError) {
      console.warn(
        `[judge-k8s] WARN  job:too-many-checks submissionId=${job.submissionId} ` +
          `checks=${job.k8sChecks.length} limit=${env.JUDGE_MAX_CHECKS}`,
      )
      await submitResult({
        submissionId: job.submissionId,
        status: 'RUNTIME_ERROR',
        runtimeMs: 0,
        errorMsg: err.message,
      })
    } else {
      console.error(
        `[judge-k8s] ERROR job:error unexpected error for submissionId=${job.submissionId}:`,
        err,
      )
      await submitResult({
        submissionId: job.submissionId,
        status: 'RUNTIME_ERROR',
        runtimeMs: 0,
        errorMsg: err instanceof Error ? err.message : String(err),
      })
    }
    continue
  }

  // ── Log per-check results ───────────────────────────────────────────────────
  for (const r of validationResults) {
    console.info(
      `[judge-k8s] INFO  validate:check-done checkId=${r.checkId} passed=${r.passed} message=${JSON.stringify(r.message)}`,
    )
  }

  // ── Assemble JudgeResult ────────────────────────────────────────────────────
  const allPassed = validationResults.every((r) => r.passed)
  const status = allPassed ? 'ACCEPTED' : 'WRONG_ANSWER'

  const result: JudgeResult = {
    submissionId: job.submissionId,
    status,
    runtimeMs: 0,
    testResults: validationResults.map((r, index) => ({
      index,
      passed: r.passed,
      input: r.checkId,         // checkId → input
      expected: r.description,  // description → expected
      actual: r.message,        // validator message → actual
      runtimeMs: 0,
    })),
  }

  await submitResult(result)
}

console.info('[judge-k8s] INFO  poll loop exited — goodbye')
process.exit(0)
