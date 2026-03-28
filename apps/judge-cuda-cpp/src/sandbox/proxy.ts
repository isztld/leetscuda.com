/**
 * proxy.ts — Docker socket-proxy helpers (§6.8, §7.1, §9)
 *
 * verifyDockerProxy()          — confirms docker ps works through the proxy;
 *                                exits with code 1 if not reachable.
 * cleanupOrphanedContainers()  — stops any running containers labelled
 *                                leetscuda-judge=1 left by a previous crash.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Run a docker CLI command. DOCKER_HOST from the environment is honoured. */
async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', args, { encoding: 'utf8' })
}

/**
 * Verifies that `docker ps` succeeds through the socket proxy (§7.1, §9 step 4).
 * If the proxy is unreachable, logs an error and calls process.exit(1).
 */
export async function verifyDockerProxy(): Promise<void> {
  try {
    await docker(['ps', '--filter', 'label=leetscuda-judge=1', '-q'])
    console.info('[judge] INFO  proxy:verify docker ps ok')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      '[judge] ERROR proxy:verify docker ps failed — ' +
        'is docker-socket-proxy running and DOCKER_HOST set correctly?\n' +
        msg,
    )
    process.exit(1)
  }
}

/**
 * Finds all running containers labelled leetscuda-judge=1 and stops them
 * with a 1-second grace period (§6.8, §9 step 5).
 *
 * This cleans up containers left behind by a previously crashed judge session.
 */
export async function cleanupOrphanedContainers(): Promise<void> {
  let ids: string[]

  try {
    const { stdout } = await docker([
      'ps',
      '--filter', 'label=leetscuda-judge=1',
      '--filter', 'status=running',
      '-q',
    ])
    ids = stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[judge] WARN  startup:orphan-cleanup docker ps failed:', msg)
    return
  }

  if (ids.length === 0) {
    console.info('[judge] INFO  startup:orphan-cleanup 0 orphaned containers found')
    return
  }

  let stopped = 0
  for (const id of ids) {
    try {
      await docker(['stop', '--time', '1', id])
      stopped++
    } catch {
      // Container may have already exited between ps and stop — ignore.
    }
  }

  console.info(`[judge] INFO  startup:orphan-cleanup ${stopped}/${ids.length} orphaned containers stopped`)
}
