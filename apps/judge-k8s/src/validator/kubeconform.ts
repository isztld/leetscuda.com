/**
 * kubeconform schema validation (§6.4 of ARCHITECTURE.md).
 *
 * runKubeconformCheck(yaml, check, timeoutMs)
 *   1. Writes the raw YAML to a uniquely-named temp file (mode 0600).
 *   2. Runs: kubeconform -strict -summary -output json -schema-location default <file>
 *   3. Parses the JSON output; collects resources with status "invalid" or "error".
 *   4. Deletes the temp file in a finally block.
 *   5. On timeout: returns a failed result with "Schema validation timed out".
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { K8sCheck, K8sValidationResult } from '../types.js'

const execFileAsync = promisify(execFile)

type KubectlDryRunCheck = Extract<K8sCheck, { type: 'kubectl-dry-run' }>

// ─── kubeconform JSON output shapes ───────────────────────────────────────────

interface KubeconformValidationError {
  path: string
  msg: string
}

interface KubeconformResource {
  filename: string
  kind: string
  name: string
  namespace?: string
  version: string
  status: 'valid' | 'invalid' | 'error' | 'skipped' | string
  msg: string
  validationErrors: KubeconformValidationError[] | null
}

interface KubeconformOutput {
  resources: KubeconformResource[]
  summary: {
    valid: number
    invalid: number
    errors: number
    skipped: number
  }
}

// ─── Error shape emitted by promisified execFile on non-zero exit ─────────────

interface ExecError extends Error {
  code?: string | number | null
  killed?: boolean
  signal?: string | null
  stdout?: string
  stderr?: string
}

function isExecError(err: unknown): err is ExecError {
  return err instanceof Error
}

function isTimeout(err: ExecError): boolean {
  return err.killed === true || err.code === 'ETIMEDOUT'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runKubeconformCheck(
  yamlStr: string,
  check: KubectlDryRunCheck,
  timeoutMs: number,
): Promise<K8sValidationResult> {
  // Unique filename avoids collisions between concurrent jobs (§6.4 temp file hygiene).
  const tmpFile = join(tmpdir(), `judge-k8s-${Date.now()}-${process.pid}.yaml`)

  try {
    await writeFile(tmpFile, yamlStr, { mode: 0o600 })

    let stdout: string

    try {
      const result = await execFileAsync(
        'kubeconform',
        ['-strict', '-summary', '-output', 'json', '-schema-location', 'default', tmpFile],
        { timeout: timeoutMs, encoding: 'utf8' },
      )
      stdout = result.stdout
    } catch (err: unknown) {
      if (!isExecError(err)) throw err

      if (isTimeout(err)) {
        console.warn(
          `[judge-k8s] WARN  validate:kubeconform-timeout checkId=${check.id} timeoutMs=${timeoutMs}`,
        )
        return {
          checkId: check.id,
          description: check.description,
          passed: false,
          message: 'Schema validation timed out',
        }
      }

      // kubeconform exits 1 when resources are invalid but still outputs valid JSON.
      if (typeof err.stdout === 'string' && err.stdout.trim().length > 0) {
        stdout = err.stdout
      } else {
        // Unexpected error (binary crash, permission denied, etc.)
        throw err
      }
    }

    const output = JSON.parse(stdout) as KubeconformOutput
    const resources = output.resources ?? []
    const failures = resources.filter((r) => r.status === 'invalid' || r.status === 'error')

    if (failures.length === 0) {
      return {
        checkId: check.id,
        description: check.description,
        passed: true,
        message: 'Manifest is valid',
      }
    }

    // Collect failure messages: prefer validationErrors[].msg, fall back to resource-level msg.
    const lines = failures.map((r) => {
      const errs = (r.validationErrors ?? []).map((e) => e.msg).filter(Boolean)
      if (errs.length > 0) return errs.join('; ')
      if (r.msg) return r.msg
      return `${r.kind}/${r.name || '<unnamed>'}: ${r.status}`
    })

    return {
      checkId: check.id,
      description: check.description,
      passed: false,
      message: lines.join('\n'),
    }
  } finally {
    try {
      await unlink(tmpFile)
    } catch {
      // best-effort cleanup — file may not exist if writeFile failed
    }
  }
}
