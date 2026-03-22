import { runSubmissionWatchdog, WATCHDOG_INTERVAL_MS } from '@/lib/submission-watchdog'

let watchdogStarted = false

export function ensureWatchdogStarted(): void {
  if (watchdogStarted) return
  watchdogStarted = true

  // Run immediately on startup to catch any submissions stuck from the last deploy/restart
  runSubmissionWatchdog().catch(console.error)

  // Then run on a fixed interval
  setInterval(() => {
    runSubmissionWatchdog().catch(console.error)
  }, WATCHDOG_INTERVAL_MS)

  console.log('[startup] Submission watchdog started')
}
