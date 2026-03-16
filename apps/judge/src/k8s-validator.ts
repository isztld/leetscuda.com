import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import yaml from 'js-yaml'
import type { K8sCheck } from './types.js'

const execFileAsync = promisify(execFile)

export type K8sValidationResult = {
  checkId: string
  description: string
  passed: boolean
  message: string
}

/**
 * Resolves a JSONPath-style path against a parsed YAML document.
 * Supports:
 *   spec.replicas                           → dot notation
 *   spec.template.spec.containers[0].image → array index
 *   resources.limits[nvidia.com/gpu]        → bracket key with dots/slashes
 *   metadata.labels[app.kubernetes.io/name] → bracket key with slashes
 */
function resolvePath(doc: unknown, pathStr: string): unknown {
  if (!pathStr) return doc

  // Tokenise the path into segments.
  // Segments are either simple identifiers or bracket-notation keys.
  const segments: string[] = []
  let remaining = pathStr

  while (remaining.length > 0) {
    // Bracket notation: [key] or [0]
    const bracketMatch = remaining.match(/^\[([^\]]+)\](.*)$/)
    if (bracketMatch) {
      segments.push(bracketMatch[1])
      remaining = bracketMatch[2]
      if (remaining.startsWith('.')) remaining = remaining.slice(1)
      continue
    }

    // Dot-separated identifier (up to the next . or [)
    const dotMatch = remaining.match(/^([^.[]+)(.*)$/)
    if (dotMatch) {
      segments.push(dotMatch[1])
      remaining = dotMatch[2]
      if (remaining.startsWith('.')) remaining = remaining.slice(1)
      continue
    }

    break
  }

  let current: unknown = doc
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined
    const asObj = current as Record<string | number, unknown>
    // Try numeric index for arrays
    const num = Number(seg)
    if (!isNaN(num) && Array.isArray(current)) {
      current = (current as unknown[])[num]
    } else {
      current = asObj[seg]
    }
  }
  return current
}

function runSchemaCheck(docs: unknown[], check: K8sCheck): K8sValidationResult {
  const assert = check.assert ?? {}
  const kind = assert['kind'] as string | undefined
  const apiVersion = assert['apiVersion'] as string | undefined

  const found = docs.some((doc) => {
    if (!doc || typeof doc !== 'object') return false
    const d = doc as Record<string, unknown>
    return (
      (!kind || d['kind'] === kind) &&
      (!apiVersion || d['apiVersion'] === apiVersion)
    )
  })

  if (found) {
    return {
      checkId: check.id,
      description: check.description,
      passed: true,
      message: check.description,
    }
  }

  const expected = [kind, apiVersion].filter(Boolean).join(' with apiVersion ')
  return {
    checkId: check.id,
    description: check.description,
    passed: false,
    message: `Expected a ${expected} resource, but none was found`,
  }
}

function applyOp(
  op: string,
  actual: unknown,
  expected: unknown,
): boolean {
  switch (op) {
    case 'exists':
      return actual != null
    case 'eq':
      // coerce strings for numeric comparisons (e.g. "1" == 1)
      // eslint-disable-next-line eqeqeq
      return actual == expected
    case 'neq':
      // eslint-disable-next-line eqeqeq
      return actual != expected
    case 'contains':
      return typeof actual === 'string' && actual.includes(String(expected))
    case 'matches':
      return typeof actual === 'string' && new RegExp(String(expected)).test(actual)
    case 'gte':
      return Number(actual) >= Number(expected)
    case 'lte':
      return Number(actual) <= Number(expected)
    case 'gt':
      return Number(actual) > Number(expected)
    case 'lt':
      return Number(actual) < Number(expected)
    default:
      return false
  }
}

function runAssertionCheck(docs: unknown[], check: K8sCheck): K8sValidationResult {
  const pathStr = check.path ?? ''
  const op = check.op ?? 'exists'
  const expectedValue = check.value

  // For multi-doc: apply against the first document that has the path, or fail if none do
  let actual: unknown = undefined
  let foundDoc = false
  for (const doc of docs) {
    const val = resolvePath(doc, pathStr)
    if (val !== undefined) {
      actual = val
      foundDoc = true
      break
    }
  }

  if (!foundDoc && op !== 'exists') {
    return {
      checkId: check.id,
      description: check.description,
      passed: false,
      message: `Expected ${pathStr} to ${op} ${JSON.stringify(expectedValue)}, got: undefined`,
    }
  }

  const passed = applyOp(op, actual, expectedValue)
  if (passed) {
    return {
      checkId: check.id,
      description: check.description,
      passed: true,
      message: check.description,
    }
  }

  return {
    checkId: check.id,
    description: check.description,
    passed: false,
    message: `Expected ${pathStr} to ${op} ${JSON.stringify(expectedValue)}, got: ${JSON.stringify(actual)}`,
  }
}

async function runKubectlDryRun(
  manifestYaml: string,
  timeoutMs: number,
): Promise<K8sValidationResult> {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `k8s-manifest-${Date.now()}-${process.pid}.yaml`)

  try {
    fs.writeFileSync(tmpFile, manifestYaml, 'utf8')

    const { stdout, stderr } = await execFileAsync(
      'kubectl',
      ['apply', '--dry-run=client', '-f', tmpFile],
      { timeout: timeoutMs },
    )
    const output = (stdout + stderr).trim()

    return {
      checkId: 'dry-run',
      description: 'Must pass kubectl apply --dry-run=client',
      passed: true,
      message: output || 'kubectl dry-run passed',
    }
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    const detail = (e.stderr ?? e.stdout ?? e.message ?? String(err)).trim()
    return {
      checkId: 'dry-run',
      description: 'Must pass kubectl apply --dry-run=client',
      passed: false,
      message: detail || 'kubectl apply --dry-run=client failed',
    }
  } finally {
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      // best-effort cleanup
    }
  }
}

export async function validateK8sManifest(
  manifestYaml: string,
  checks: K8sCheck[],
  opts: { multiDoc: boolean; timeoutMs: number },
): Promise<K8sValidationResult[]> {
  // Step 1 — Parse YAML
  let docs: unknown[]
  try {
    if (opts.multiDoc) {
      docs = yaml.loadAll(manifestYaml) as unknown[]
    } else {
      docs = [yaml.load(manifestYaml)]
    }
    // Filter out nulls (empty YAML docs from trailing ---)
    docs = docs.filter((d) => d != null)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return [
      {
        checkId: 'yaml-parse',
        description: 'YAML must be valid',
        passed: false,
        message,
      },
    ]
  }

  const results: K8sValidationResult[] = []

  // Step 2-4 — Run each check
  for (const check of checks) {
    if (check.type === 'schema') {
      results.push(runSchemaCheck(docs, check))
    } else if (check.type === 'assertion') {
      results.push(runAssertionCheck(docs, check))
    } else if (check.type === 'kubectl-dry-run') {
      results.push(await runKubectlDryRun(manifestYaml, opts.timeoutMs))
    }
  }

  return results
}
