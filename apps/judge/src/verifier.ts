const FLOAT_TOLERANCE = 0.001

function looksLikeFloat(s: string): boolean {
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s.trim())
}

function compareLines(actual: string, expected: string): boolean {
  const aLines = actual.trim().replace(/\r\n/g, '\n').split('\n')
  const eLines = expected.trim().replace(/\r\n/g, '\n').split('\n')

  if (aLines.length !== eLines.length) return false

  for (let i = 0; i < eLines.length; i++) {
    const a = aLines[i].trim()
    const e = eLines[i].trim()
    if (a === e) continue

    if (looksLikeFloat(a) && looksLikeFloat(e)) {
      if (Math.abs(parseFloat(a) - parseFloat(e)) <= FLOAT_TOLERANCE) continue
    }

    return false
  }

  return true
}

// Expand fill:N:X shorthand used in MDX test cases (e.g. "fill:256:0.0" → "0.0 0.0 ...")
function expandFills(s: string): string {
  return s.replace(/fill:(\d+):([-\d.eE+]+)/g, (_, n, v) =>
    Array(parseInt(n, 10)).fill(v).join(' '),
  )
}

export function verify(actual: string, expected: string): boolean {
  return compareLines(actual, expandFills(expected))
}
