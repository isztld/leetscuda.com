/**
 * Output verifier — pure function, no I/O.
 *
 * Supported expected-output formats (§8 of ARCHITECTURE):
 *
 *   Literal          "3.14159"            exact match after per-line whitespace trim
 *   Float tolerance  "~0.001 3.14159"     |actual − expected| ≤ tolerance
 *   Fill shorthand   "fill(N, value)"     expands to N space-separated copies of value
 *   Multi-line       any combo above      each line matched independently; all must pass
 */

// ─── Fill shorthand expansion ─────────────────────────────────────────────────

/**
 * Expands `fill(N, value)` occurrences in `s` to N space-separated copies of
 * `value`. Multiple fill directives on a single line are each expanded in turn.
 *
 * Examples:
 *   "fill(3, 0.0)"        → "0.0 0.0 0.0"
 *   "fill(2, -1.5e-3)"    → "-1.5e-3 -1.5e-3"
 */
function expandFills(s: string): string {
  return s.replace(/fill\((\d+),\s*([-\d.eE+]+)\)/g, (_, n, v) =>
    Array(parseInt(n, 10)).fill(v as string).join(' '),
  )
}

// ─── Single-line matcher ──────────────────────────────────────────────────────

/**
 * Matches one trimmed actual line against one trimmed expected line.
 *
 * If expected starts with `~`, it is a float-tolerance directive:
 *   "~<tol> <value>"  passes iff |parseFloat(actual) − value| ≤ tol
 *
 * Otherwise, plain string equality after trim.
 */
function matchLine(actual: string, expected: string): boolean {
  const a = actual.trim()
  const e = expected.trim()

  if (a === e) return true

  // Float tolerance: ~<tolerance> <expected-value>
  const toleranceMatch = e.match(/^~([\d.eE+]+)\s+([-\d.eE+]+)$/)
  if (toleranceMatch) {
    const tol = parseFloat(toleranceMatch[1]!)
    const exp = parseFloat(toleranceMatch[2]!)
    const act = parseFloat(a)
    if (Number.isFinite(act) && Number.isFinite(exp) && Number.isFinite(tol)) {
      return Math.abs(act - exp) <= tol
    }
  }

  return false
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true iff `actual` (program stdout) matches `expected` (test-case
 * expected output from MDX).
 *
 * Steps:
 *   1. Expand fill shorthands in `expected`.
 *   2. Normalise line endings to `\n`, trim trailing whitespace from the whole
 *      string, then split into lines.
 *   3. Line counts must match.
 *   4. Every line pair must satisfy `matchLine`.
 */
export function verify(actual: string, expected: string): boolean {
  const expandedExpected = expandFills(expected)

  const normalise = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()

  const aLines = normalise(actual).split('\n')
  const eLines = normalise(expandedExpected).split('\n')

  if (aLines.length !== eLines.length) return false

  return aLines.every((a, i) => matchLine(a, eLines[i]!))
}
