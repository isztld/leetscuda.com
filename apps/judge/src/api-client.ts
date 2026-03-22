import { env } from './env.js'
import { JudgeJobSchema, type JudgeJob, type JudgeResult } from './types.js'

const BASE_HEADERS = {
  Authorization: `Bearer ${env.JUDGE_API_TOKEN}`,
  'Content-Type': 'application/json',
  'X-Judge-Capabilities': env.capabilities.join(','),
}

// Exponential backoff state for network errors
let backoffMs = 5_000
const MAX_BACKOFF_MS = 60_000

function resetBackoff() {
  backoffMs = 5_000
}

function nextBackoff() {
  const current = backoffMs
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
  return current
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function pollForJob(): Promise<JudgeJob | null> {
  let res: Response
  try {
    res = await fetch(`${env.JUDGE_API_URL}/api/judge/poll`, {
      method: 'GET',
      headers: BASE_HEADERS,
    })
  } catch (err) {
    const delay = nextBackoff()
    console.error(`[judge] Network error during poll, retrying in ${delay / 1000}s:`, err)
    await sleep(delay)
    return null
  }

  resetBackoff()

  if (res.status === 401) {
    console.error('[judge] 401 Unauthorized — check JUDGE_API_TOKEN. Exiting.')
    process.exit(1)
  }

  if (res.status === 429) {
    console.warn('[judge] 429 Too Many Requests — backing off 60s')
    await sleep(60_000)
    return null
  }

  if (res.status === 204) {
    return null // no jobs available
  }

  if (!res.ok) {
    console.error(`[judge] Unexpected poll response: ${res.status}`)
    await sleep(nextBackoff())
    return null
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    console.error('[judge] Failed to parse poll response as JSON')
    return null
  }

  const parsed = JudgeJobSchema.safeParse(data)
  if (!parsed.success) {
    console.error('[judge] Invalid job payload from server:', parsed.error.message)
    return null
  }

  return parsed.data
}

export async function recoverStuckSubmissions(): Promise<number> {
  try {
    const res = await fetch(`${env.JUDGE_API_URL}/api/judge/recover`, {
      method: 'POST',
      headers: BASE_HEADERS,
    })
    if (res.status === 401) {
      console.log('[judge] Authentication failed during recovery — check JUDGE_API_TOKEN')
      process.exit(1)
    }
    const data = await res.json() as { recovered?: number }
    return data.recovered ?? 0
  } catch (err) {
    console.log(`[judge] Recovery call failed: ${err} — continuing anyway`)
    return 0
  }
}

export async function submitResult(result: JudgeResult): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${env.JUDGE_API_URL}/api/judge/result`, {
      method: 'POST',
      headers: BASE_HEADERS,
      body: JSON.stringify(result),
    })
  } catch (err) {
    const delay = nextBackoff()
    console.error(`[judge] Network error submitting result, retrying in ${delay / 1000}s:`, err)
    await sleep(delay)
    // Best-effort: try once more
    try {
      await fetch(`${env.JUDGE_API_URL}/api/judge/result`, {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify(result),
      })
    } catch {
      console.error(`[judge] Failed to submit result for ${result.submissionId} after retry`)
    }
    return
  }

  resetBackoff()

  if (res.status === 401) {
    console.error('[judge] 401 Unauthorized on result submit — check JUDGE_API_TOKEN. Exiting.')
    process.exit(1)
  }

  if (!res.ok) {
    console.error(`[judge] Unexpected result response: ${res.status} for ${result.submissionId}`)
  }
}
