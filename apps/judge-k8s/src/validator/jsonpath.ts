/**
 * Minimal JSONPath resolver (§7 of ARCHITECTURE.md).
 *
 * Supported syntax:
 *   spec.replicas                        — dot notation
 *   spec.containers[0].image             — array index
 *   resources.limits[nvidia.com/gpu]     — bracket key (dots / slashes allowed)
 *   metadata.labels[app.kubernetes.io/name] — mixed dot + bracket
 *
 * Unsupported (wildcard, recursive descent, filter, union) → returns undefined.
 * Pure function — no I/O, no mutation.
 */

type Token = string | number

/**
 * Tokenise a JSONPath-style path string into an ordered list of keys / indices.
 *
 * Walk character-by-character:
 *   '.'  → flush current accumulator as a string token
 *   '['  → flush accumulator, read until ']', push as number or string
 *   else → accumulate into current segment
 */
function tokenize(pathStr: string): Token[] {
  const tokens: Token[] = []
  let current = ''

  for (let i = 0; i < pathStr.length; i++) {
    const ch = pathStr[i]

    if (ch === '.') {
      if (current !== '') {
        tokens.push(current)
        current = ''
      }
      // skip the dot — the next char starts a new segment
    } else if (ch === '[') {
      if (current !== '') {
        tokens.push(current)
        current = ''
      }
      i++ // advance past '['
      let bracket = ''
      while (i < pathStr.length && pathStr[i] !== ']') {
        bracket += pathStr[i]
        i++
      }
      // i now points at ']' (or end-of-string if malformed); the outer loop's
      // i++ will advance past it on the next iteration.
      if (/^\d+$/.test(bracket)) {
        tokens.push(parseInt(bracket, 10))
      } else {
        tokens.push(bracket)
      }
    } else {
      current += ch
    }
  }

  if (current !== '') {
    tokens.push(current)
  }

  return tokens
}

/**
 * Resolve a JSONPath-style `pathStr` against `doc`.
 *
 * Returns `undefined` if any segment is not found or the type is wrong
 * (e.g. array index used on a non-array, string key used on a non-object).
 */
export function resolvePath(doc: unknown, pathStr: string): unknown {
  const tokens = tokenize(pathStr)
  let current: unknown = doc

  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (typeof token === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[token]
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) return undefined
      current = (current as Record<string, unknown>)[token]
    }
  }

  return current
}
