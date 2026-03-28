/**
 * Assertion check — JSONPath + operator (§6.3 of ARCHITECTURE.md).
 *
 * runAssertionCheck(docs, check)
 *   Resolves the check's path against each document in order; uses the value
 *   from the first document that returns a non-undefined result.
 *   If no document has the path and the operator is not 'exists', the check
 *   fails with a "got: undefined" message.
 */

import type { K8sCheck, K8sValidationResult } from '../types.js'
import { resolvePath } from './jsonpath.js'
import { applyOp } from './operators.js'

type AssertionCheck = Extract<K8sCheck, { type: 'assertion' }>

export function runAssertionCheck(docs: unknown[], check: AssertionCheck): K8sValidationResult {
  // Find the first document that yields a non-undefined value for the path.
  let actual: unknown = undefined
  for (const doc of docs) {
    const val = resolvePath(doc, check.path)
    if (val !== undefined) {
      actual = val
      break
    }
  }

  const passed = applyOp(check.op, actual, check.value)

  let message: string
  if (passed) {
    message = `${check.path} = ${JSON.stringify(actual)}`
  } else if (check.op === 'exists') {
    message = `${check.path} does not exist`
  } else if (actual === undefined) {
    message = 'got: undefined'
  } else {
    message = `expected ${check.op} ${JSON.stringify(check.value)}, got: ${JSON.stringify(actual)}`
  }

  return {
    checkId: check.id,
    description: check.description,
    passed,
    message,
  }
}
