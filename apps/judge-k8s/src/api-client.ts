import type { Env } from './env.js'
import { K8sJudgeJobSchema, type K8sJudgeJob, type JudgeResult } from './types.js'

// Module-level env reference — set once by main.ts via init()
let _env: Env | null = null
let _headers: Record<string, string> | null = null

export function init(env: Env): void {
  _env = env
  _headers = {
    Authorization: `Bearer ${env.JUDGE_API_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Judge-Capabilities': env.JUDGE_CAPABILITIES,
  }
}

function env(): Env {
  if (!_env) throw new Error('[judge-k8s] api-client not initialized — call init(env) first')
  return _env
}

function headers(): Record<string, string> {
  if (!_headers) throw new Error('[judge-k8s] api-client not initialized — call init(env) first')
  return _headers
}

// ─── Exponential backoff state ────────────────────────────────────────────────

const MIN_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 60_000

let backoffMs = MIN_BACKOFF_MS

function resetBackoff(): void {
  backoffMs = MIN_BACKOFF_MS
}

function consumeBackoff(): number {
  const delay = backoffMs
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
  return delay
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── pollForJob ───────────────────────────────────────────────────────────────

/**
 * Long-polls for a job from GET /api/judge/poll.
 *
 * Returns the parsed job payload, or null when no job is available (204) or a
 * recoverable error occurs (network error, invalid payload). Backs off
 * exponentially (5 s → 60 s) on network errors and sleeps 60 s on 429.
 * Exits the process immediately on 401.
 */
export async function pollForJob(): Promise<K8sJudgeJob | null> {
  let res: Response
  try {
    res = await fetch(`${env().JUDGE_API_URL}/api/judge/poll`, {
      method: 'GET',
      headers: headers(),
    })
  } catch (err) {
    const delay = consumeBackoff()
    console.warn(
      `[judge-k8s] WARN  poll:backoff network error — retrying in ${delay / 1_000}s:`,
      err,
    )
    await sleep(delay)
    return null
  }

  resetBackoff()

  if (res.status === 401) {
    console.error(
      '[judge-k8s] ERROR auth:rejected 401 on poll — check JUDGE_API_TOKEN. Exiting.',
    )
    process.exit(1)
  }

  if (res.status === 429) {
    console.warn('[judge-k8s] WARN  poll:backoff 429 Too Many Requests — sleeping 60s')
    await sleep(60_000)
    return null
  }

  if (res.status === 204) {
    return null
  }

  if (!res.ok) {
    const delay = consumeBackoff()
    console.error(
      `[judge-k8s] ERROR poll unexpected status ${res.status} — retrying in ${delay / 1_000}s`,
    )
    await sleep(delay)
    return null
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    console.error('[judge-k8s] ERROR poll failed to parse response body as JSON')
    return null
  }

  const parsed = K8sJudgeJobSchema.safeParse(data)
  if (!parsed.success) {
    console.error('[judge-k8s] ERROR poll invalid job payload:', parsed.error.message)
    return null
  }

  return parsed.data
}

// ─── submitResult ─────────────────────────────────────────────────────────────

/**
 * POSTs a completed JudgeResult to /api/judge/result.
 *
 * Makes one automatic retry on a network error. Exits the process on 401.
 * Logs but does not throw on non-200 responses after retry exhaustion.
 */
export async function submitResult(result: JudgeResult): Promise<void> {
  const body = JSON.stringify(result)

  async function attempt(): Promise<Response> {
    return fetch(`${env().JUDGE_API_URL}/api/judge/result`, {
      method: 'POST',
      headers: headers(),
      body,
    })
  }

  let res: Response
  try {
    res = await attempt()
  } catch (err) {
    const delay = consumeBackoff()
    console.warn(
      `[judge-k8s] WARN  result:retry network error for ${result.submissionId} — retrying in ${delay / 1_000}s:`,
      err,
    )
    await sleep(delay)

    try {
      res = await attempt()
    } catch (retryErr) {
      console.error(
        `[judge-k8s] ERROR result:failed could not deliver result for ${result.submissionId} after retry:`,
        retryErr,
      )
      return
    }
  }

  resetBackoff()

  if (res.status === 401) {
    console.error(
      '[judge-k8s] ERROR auth:rejected 401 on result submit — check JUDGE_API_TOKEN. Exiting.',
    )
    process.exit(1)
  }

  if (!res.ok) {
    console.error(
      `[judge-k8s] ERROR result:failed unexpected status ${res.status} for ${result.submissionId}`,
    )
    return
  }

  console.info(`[judge-k8s] INFO  result:submitted ${result.submissionId} → ${result.status}`)
}

// ─── recoverStuckSubmissions ──────────────────────────────────────────────────

/**
 * POSTs to /api/judge/recover on startup.
 *
 * Asks the web app to mark any submissions left in RUNNING state as
 * RUNTIME_ERROR (handles the previous-judge-crash case). Returns the number
 * of submissions recovered. Non-fatal — logs and returns 0 on any error so
 * startup can continue.
 */
export async function recoverStuckSubmissions(): Promise<number> {
  try {
    const res = await fetch(`${env().JUDGE_API_URL}/api/judge/recover`, {
      method: 'POST',
      headers: headers(),
    })

    if (res.status === 401) {
      console.error(
        '[judge-k8s] ERROR auth:rejected 401 on recover — check JUDGE_API_TOKEN. Exiting.',
      )
      process.exit(1)
    }

    const data = (await res.json()) as { recovered?: number }
    const count = data.recovered ?? 0
    console.info(`[judge-k8s] INFO  startup:recovery recovered ${count} stuck submission(s)`)
    return count
  } catch (err) {
    console.warn(`[judge-k8s] WARN  startup:recovery call failed — continuing anyway:`, err)
    return 0
  }
}
