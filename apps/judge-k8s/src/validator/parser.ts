/**
 * YAML parser for k8s manifest submissions (§6.1 of ARCHITECTURE.md).
 *
 * parseManifest(yaml, opts)
 *   1. Rejects the raw string if it exceeds opts.maxBytes BEFORE calling js-yaml
 *      (prevents YAML-bomb anchor expansion).
 *   2. Parses with yaml.DEFAULT_SAFE_SCHEMA (disallows !!js/* tags).
 *   3. Supports single-doc (opts.multiDoc = false) and multi-doc streams.
 *   4. Filters null documents (trailing '---' separators).
 *   5. Returns the document array or throws ParseError.
 */

import * as yaml from 'js-yaml'

export interface ParseOpts {
  /** When true, treat the manifest as a multi-document YAML stream. */
  multiDoc: boolean
  /** Max byte length of the raw YAML string. Checked before any parsing. */
  maxBytes: number
}

/** Thrown by parseManifest on size-guard violation or YAML syntax errors. */
export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

/**
 * Parse `yamlStr` into an array of YAML documents.
 *
 * @throws {ParseError} if the string exceeds maxBytes or contains invalid YAML.
 */
export function parseManifest(yamlStr: string, opts: ParseOpts): unknown[] {
  // ── Size guard (must fire before yaml.load* to prevent YAML bombs) ──────────
  if (yamlStr.length > opts.maxBytes) {
    throw new ParseError(
      `Manifest exceeds maximum size (${yamlStr.length} > ${opts.maxBytes} bytes)`,
    )
  }

  // js-yaml v4: DEFAULT_SCHEMA is the safe schema (js/* tags were removed in v4).
  const schema = yaml.DEFAULT_SCHEMA

  try {
    if (opts.multiDoc) {
      const docs: unknown[] = []
      yaml.loadAll(yamlStr, (doc) => docs.push(doc), { schema })
      // Filter out null documents produced by trailing '---' separators
      return docs.filter((d) => d !== null && d !== undefined)
    } else {
      const doc = yaml.load(yamlStr, { schema })
      // A single-doc parse that yields null (empty file) is treated as empty
      return doc !== null && doc !== undefined ? [doc] : []
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ParseError(msg)
  }
}
