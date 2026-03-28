/**
 * Schema check — kind/apiVersion presence (§6.2 of ARCHITECTURE.md).
 *
 * runSchemaCheck(docs, check)
 *   Iterates over the parsed document array and returns passed = true if any
 *   document matches the asserted kind (and optionally apiVersion).
 *   Comparison is strict string equality.
 */

import type { K8sCheck, K8sValidationResult } from '../types.js'

type SchemaCheck = Extract<K8sCheck, { type: 'schema' }>

export function runSchemaCheck(docs: unknown[], check: SchemaCheck): K8sValidationResult {
  const { kind, apiVersion } = check.assert

  const found = docs.some((doc) => {
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return false
    const d = doc as Record<string, unknown>
    if (d['kind'] !== kind) return false
    if (apiVersion !== undefined && d['apiVersion'] !== apiVersion) return false
    return true
  })

  const resource = apiVersion !== undefined ? `${apiVersion}/${kind}` : kind

  return {
    checkId: check.id,
    description: check.description,
    passed: found,
    message: found ? `Found ${resource} resource` : `No ${resource} resource found in manifest`,
  }
}
