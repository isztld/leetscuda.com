/**
 * Validation pipeline orchestrator (§6 of ARCHITECTURE.md).
 *
 * validateK8sManifest(yaml, checks, opts)
 *   1. Max-checks guard (before any work).
 *   2. YAML parse (size guard + safe schema).
 *      On parse failure → return a single synthetic failing result; no checks run.
 *   3. Run all checks in order with no short-circuit.
 *   4. Return K8sValidationResult[].
 */

import type { K8sCheck, K8sValidationResult } from '../types.js'
import { parseManifest, ParseError } from './parser.js'
import { runSchemaCheck } from './schema.js'
import { runAssertionCheck } from './assertion.js'
import { runKubeconformCheck } from './kubeconform.js'

export type { K8sValidationResult }

export interface ValidateOpts {
  /** When true, parse as a multi-document YAML stream. */
  multiDoc: boolean
  /** Hard ceiling on raw YAML byte length (checked before parsing). */
  maxBytes: number
  /** Hard ceiling on the number of checks per job. */
  maxChecks: number
  /**
   * Wall-clock limit passed to kubeconform (already clamped by the caller to
   * JUDGE_MAX_TIMEOUT_MS).
   */
  timeoutMs: number
}

/** Thrown when the checks array exceeds opts.maxChecks. */
export class TooManyChecksError extends Error {
  constructor(count: number, limit: number) {
    super(`Too many checks: ${count} exceeds limit of ${limit}`)
    this.name = 'TooManyChecksError'
  }
}

/**
 * Run the full validation pipeline against `yamlStr` and return one result per
 * check (or a single synthetic parse-error result on YAML failure).
 *
 * @throws {TooManyChecksError} if checks.length > opts.maxChecks.
 */
export async function validateK8sManifest(
  yamlStr: string,
  checks: K8sCheck[],
  opts: ValidateOpts,
): Promise<K8sValidationResult[]> {
  // ── Max-checks guard ────────────────────────────────────────────────────────
  if (checks.length > opts.maxChecks) {
    throw new TooManyChecksError(checks.length, opts.maxChecks)
  }

  // ── YAML parse ──────────────────────────────────────────────────────────────
  let docs: unknown[]
  try {
    docs = parseManifest(yamlStr, { multiDoc: opts.multiDoc, maxBytes: opts.maxBytes })
  } catch (err) {
    const message = err instanceof ParseError || err instanceof Error ? err.message : String(err)
    return [
      {
        checkId: 'yaml-parse',
        description: 'YAML must be valid',
        passed: false,
        message,
      },
    ]
  }

  // ── Run all checks (no short-circuit) ───────────────────────────────────────
  const results: K8sValidationResult[] = []

  for (const check of checks) {
    switch (check.type) {
      case 'schema':
        results.push(runSchemaCheck(docs, check))
        break

      case 'assertion':
        results.push(runAssertionCheck(docs, check))
        break

      case 'kubectl-dry-run':
        results.push(await runKubeconformCheck(yamlStr, check, opts.timeoutMs))
        break
    }
  }

  return results
}
