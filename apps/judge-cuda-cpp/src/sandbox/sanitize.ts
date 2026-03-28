/**
 * sanitize.ts — output sanitization (§6.7)
 *
 * Strips ANSI CSI sequences, all other ESC-based sequences, and any
 * non-printable characters that are not \t, \n, or \r.
 * Prevents terminal-injection attacks in the result UI.
 */

/**
 * Removes ANSI escape sequences and non-printable characters from a string.
 *
 * Kept: \t (0x09), \n (0x0A), \r (0x0D), printable ASCII (0x20–0x7E).
 * Removed: ESC CSI sequences (ESC [ ... final), other ESC sequences, all
 *           other control characters and high bytes.
 */
export function sanitizeOutput(s: string): string {
  let out = s

  // Strip ANSI CSI sequences:  ESC [ <param bytes 0x30-0x3F>* <intermediate bytes 0x20-0x2F>* <final byte 0x40-0x7E>
  out = out.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '')

  // Strip OSC sequences:  ESC ] ... (ST = ESC \ or BEL)
  out = out.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')

  // Strip remaining two-byte ESC sequences:  ESC <0x20-0x7E>
  out = out.replace(/\x1b[\x20-\x7e]/g, '')

  // Remove any lone remaining ESC
  out = out.replace(/\x1b/g, '')

  // Filter character-by-character: keep \t \n \r and printable ASCII only
  let result = ''
  for (let i = 0; i < out.length; i++) {
    const c = out.charCodeAt(i)
    if (c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0x7e)) {
      result += out[i]
    }
  }
  return result
}
