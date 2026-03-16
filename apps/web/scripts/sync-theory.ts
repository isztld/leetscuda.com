/**
 * sync-theory.ts
 * Scans /theory/**\/index.mdx, validates frontmatter, and verifies every
 * CONCEPT RoadmapNode in the database has a corresponding theory file.
 *
 * Usage: pnpm theory:sync  (run from apps/web; process.cwd() = apps/web)
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'
import { PrismaClient, NodeType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// ── Schema ────────────────────────────────────────────────────────────────────

const TheoryFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  track: z.string().min(1),
  type: z.literal('concept'),
  status: z.enum(['published', 'draft']),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// process.cwd() = apps/web when script is run via pnpm
const LEARNING_DIR = path.join(process.cwd(), '../../learning')

function getTheoryDirs(learningDir: string): string[] {
  if (!fs.existsSync(learningDir)) return []
  return fs
    .readdirSync(learningDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(learningDir, d.name, 'theory'))
    .filter((d) => fs.existsSync(d))
}

function ok(msg: string) { console.log(`  ✅ ${msg}`) }
function warn(msg: string) { console.warn(`  ⚠️  ${msg}`) }
function fail(msg: string) { console.error(`  ❌ ${msg}`) }

/** Recursively find all index.mdx files under a directory */
function findMdxFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findMdxFiles(full))
    } else if (entry.isFile() && entry.name === 'index.mdx') {
      results.push(full)
    }
  }
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍  Scanning theory content...\n')
  console.log(`Learning dir: ${LEARNING_DIR}\n`)

  const theoryDirs = getTheoryDirs(LEARNING_DIR)
  const files = theoryDirs.flatMap(findMdxFiles)
  console.log(`Found ${files.length} theory file(s)\n`)

  const validSlugs = new Set<string>()
  let fileErrors = 0

  for (const filePath of files) {
    const rel = path.relative(LEARNING_DIR, filePath)
    let raw: string
    try {
      raw = fs.readFileSync(filePath, 'utf8')
    } catch {
      fail(`Cannot read ${rel}`)
      fileErrors++
      continue
    }

    const { data } = matter(raw)
    const parsed = TheoryFrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      fail(
        `Invalid frontmatter in ${rel}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      )
      fileErrors++
      continue
    }

    ok(`${rel}  →  "${parsed.data.title}" [${parsed.data.status}]`)
    validSlugs.add(parsed.data.slug)
  }

  // 2. Query DB for CONCEPT nodes
  console.log('\n🗄️   Verifying database coverage...\n')

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

  let conceptNodes: { slug: string; title: string; track: { slug: string } }[] = []
  try {
    conceptNodes = await prisma.roadmapNode.findMany({
      where: { type: NodeType.CONCEPT },
      select: { slug: true, title: true, track: { select: { slug: true } } },
      orderBy: [{ track: { order: 'asc' } }, { order: 'asc' }],
    })
  } finally {
    await prisma.$disconnect()
  }

  let missing = 0
  for (const node of conceptNodes) {
    if (validSlugs.has(node.slug)) {
      ok(`${node.track.slug}/${node.slug}  →  "${node.title}"`)
    } else {
      warn(
        `Missing theory file for CONCEPT "${node.title}" → create learning/${node.track.slug}/theory/${node.slug}/index.mdx`,
      )
      missing++
    }
  }

  // 3. Summary
  console.log('\n─────────────────────────────────────────────')
  console.log(`Theory files scanned : ${files.length}`)
  console.log(`Valid files          : ${files.length - fileErrors}`)
  console.log(`File errors          : ${fileErrors}`)
  console.log(`CONCEPT nodes in DB  : ${conceptNodes.length}`)
  console.log(`Missing theory files : ${missing}`)
  console.log('─────────────────────────────────────────────\n')

  if (fileErrors > 0 || missing > 0) {
    process.exit(1)
  }

  console.log('✅  All CONCEPT nodes have theory files. Done.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
