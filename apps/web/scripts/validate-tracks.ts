/**
 * validate-tracks.ts
 * Validates all track.mdx files in /learning against schema requirements:
 *   1. Required track-level frontmatter fields are present and non-empty
 *   2. Each node entry has all required fields
 *   3. Each node slug resolves to an index.mdx file on disk
 *   4. No duplicate node slugs within a track
 *   5. Node `order` values are sequential (1-based, no gaps, no duplicates)
 *
 * Usage: pnpm validate:tracks  (run from apps/web)
 * Exit code: 0 if all tracks valid, 1 if any errors found.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'

// ── Schema ────────────────────────────────────────────────────────────────────

const TrackNodeSchema = z.object({
  slug: z.string().min(1, 'slug is required'),
  title: z.string().min(1, 'title is required'),
  type: z.enum(['CONCEPT', 'PROBLEM', 'ARTICLE'], {
    error: 'type must be CONCEPT, PROBLEM, or ARTICLE',
  }),
  cluster: z.string().min(1, 'cluster is required'),
  order: z.number().int().positive('order must be a positive integer'),
  difficulty: z.enum(['easy', 'intermediate', 'advanced', 'expert'], {
    error: 'difficulty must be easy|intermediate|advanced|expert',
  }),
  estimatedMinutes: z.number().int().positive('estimatedMinutes must be a positive integer'),
  prerequisites: z.array(z.string()).default([]),
  description: z.string().min(1, 'description is required'),
  interviewRelevance: z.enum(['low', 'medium', 'high'], {
    error: 'interviewRelevance must be low|medium|high',
  }),
})

const TrackFrontmatterSchema = z.object({
  slug: z.string().min(1, 'slug is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  icon: z.string().min(1, 'icon is required'),
  color: z.string().min(1, 'color is required'),
  order: z.number().int().positive('order must be a positive integer'),
  nodes: z.array(z.unknown()).min(1, 'nodes array must not be empty'),
})

// ── Types ─────────────────────────────────────────────────────────────────────

type ValidationError = { file: string; field: string; message: string }
type ValidationWarning = { file: string; field: string; message: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEARNING_DIR = path.join(process.cwd(), '../../learning')

function ok(msg: string) { console.log(`  ✅ ${msg}`) }
function warn(msg: string) { console.warn(`  ⚠️  ${msg}`) }
function fail(msg: string) { console.error(`  ❌ ${msg}`) }
function section(msg: string) { console.log(`\n── ${msg} ──────────────────────────────────`) }

/**
 * Find an index.mdx for a given node slug under the track directory.
 * Searches theory/, problems/, articles/ subdirectories.
 */
function findNodeMdx(trackDir: string, slug: string): string | null {
  const searchDirs = ['theory', 'problems', 'articles']
  for (const sub of searchDirs) {
    const candidate = path.join(trackDir, sub, slug, 'index.mdx')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(LEARNING_DIR)) {
    fail(`Learning directory not found: ${LEARNING_DIR}`)
    process.exit(1)
  }

  const allErrors: ValidationError[] = []
  const allWarnings: ValidationWarning[] = []
  let trackCount = 0
  let nodeCount = 0

  const trackEntries = fs.readdirSync(LEARNING_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of trackEntries) {
    const trackDir = path.join(LEARNING_DIR, entry.name)
    const trackMdxPath = path.join(trackDir, 'track.mdx')

    if (!fs.existsSync(trackMdxPath)) {
      allWarnings.push({
        file: `${entry.name}/track.mdx`,
        field: '',
        message: 'No track.mdx found — skipping',
      })
      continue
    }

    trackCount++
    const relPath = path.relative(LEARNING_DIR, trackMdxPath)
    section(relPath)

    // Parse frontmatter
    let raw: string
    try {
      raw = fs.readFileSync(trackMdxPath, 'utf-8')
    } catch (e) {
      allErrors.push({ file: relPath, field: '', message: `Cannot read file: ${e}` })
      fail(`Cannot read ${relPath}`)
      continue
    }

    const { data } = matter(raw)
    const trackErrors: ValidationError[] = []

    // Validate track-level schema
    const trackResult = TrackFrontmatterSchema.safeParse(data)
    if (!trackResult.success) {
      for (const issue of trackResult.error.issues) {
        const field = issue.path.join('.')
        trackErrors.push({ file: relPath, field, message: issue.message })
      }
    }

    // Validate each node
    const nodes: unknown[] = Array.isArray(data.nodes) ? data.nodes : []
    const seenSlugs = new Set<string>()
    const seenOrders = new Set<number>()

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (typeof node !== 'object' || node === null) {
        trackErrors.push({ file: relPath, field: `nodes[${i}]`, message: 'Node entry is not an object' })
        continue
      }

      const nodeResult = TrackNodeSchema.safeParse(node)
      const nodeSlug = (node as Record<string, unknown>).slug as string | undefined

      if (!nodeResult.success) {
        for (const issue of nodeResult.error.issues) {
          const field = `nodes[${i}]${nodeSlug ? ` (${nodeSlug})` : ''}.${issue.path.join('.')}`
          trackErrors.push({ file: relPath, field, message: issue.message })
        }
      }

      if (nodeSlug) {
        nodeCount++

        // Duplicate slug check
        if (seenSlugs.has(nodeSlug)) {
          trackErrors.push({ file: relPath, field: `nodes[${i}].slug`, message: `Duplicate slug: "${nodeSlug}"` })
        }
        seenSlugs.add(nodeSlug)

        // Check MDX file exists on disk
        const mdxPath = findNodeMdx(trackDir, nodeSlug)
        if (!mdxPath) {
          trackErrors.push({
            file: relPath,
            field: `nodes[${i}].slug`,
            message: `No index.mdx found for slug "${nodeSlug}" (searched theory/, problems/, articles/)`,
          })
        }
      }

      // Duplicate order check
      const nodeOrder = (node as Record<string, unknown>).order as number | undefined
      if (typeof nodeOrder === 'number') {
        if (seenOrders.has(nodeOrder)) {
          trackErrors.push({ file: relPath, field: `nodes[${i}].order`, message: `Duplicate order value: ${nodeOrder}` })
        }
        seenOrders.add(nodeOrder)
      }
    }

    // Verify sequential orders (1-based, no gaps)
    if (seenOrders.size > 0) {
      const sorted = Array.from(seenOrders).sort((a, b) => a - b)
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i + 1) {
          allWarnings.push({
            file: relPath,
            field: 'nodes[*].order',
            message: `Non-sequential orders: expected ${i + 1}, got ${sorted[i]}`,
          })
          break
        }
      }
    }

    // Report results for this track
    if (trackErrors.length === 0) {
      ok(`${relPath} — ${nodes.length} nodes, all valid`)
    } else {
      for (const e of trackErrors) {
        fail(`${e.field}: ${e.message}`)
      }
      allErrors.push(...trackErrors)
    }
  }

  // Summary
  section('Summary')
  console.log(`Tracks scanned : ${trackCount}`)
  console.log(`Total nodes    : ${nodeCount}`)
  console.log(`Errors         : ${allErrors.length}`)
  console.log(`Warnings       : ${allWarnings.length}`)

  if (allWarnings.length > 0) {
    console.log('\nWarnings:')
    for (const w of allWarnings) {
      warn(`${w.file}${w.field ? ` [${w.field}]` : ''}: ${w.message}`)
    }
  }

  if (allErrors.length > 0) {
    console.error(`\n❌  ${allErrors.length} validation error(s). Fix all errors above and re-run.`)
    process.exit(1)
  }

  console.log('\n✅  All tracks valid.')
  process.exit(0)
}

main()
