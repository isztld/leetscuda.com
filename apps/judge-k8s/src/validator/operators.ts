/**
 * Assertion operators (§8 of ARCHITECTURE.md).
 *
 * applyOp(op, actual, expected) — returns true when the assertion passes.
 * Unknown operators always return false.
 */

export type Op = 'eq' | 'neq' | 'exists' | 'contains' | 'matches' | 'gte' | 'lte' | 'gt' | 'lt'

export function applyOp(op: string, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case 'exists':
      return actual !== null && actual !== undefined

    case 'eq':
      // loose equality — allows "1" == 1 per spec
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
