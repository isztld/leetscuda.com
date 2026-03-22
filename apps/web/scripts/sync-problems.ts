/**
 * sync-problems.ts
 * Scans problems/**\/index.mdx, validates frontmatter, and upserts each
 * problem into the database using slug as the unique key.
 *
 * Usage: pnpm --filter @leetscuda/web db:sync  (run from apps/web)
 */

import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { PrismaClient, Difficulty, ProblemStatus, ExecutionRuntime, CppStandard } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { scanProblems } from '../lib/sync/scan-problems'
import type { ProblemFrontmatter } from '../lib/sync/validate-frontmatter'

// ── Directory ─────────────────────────────────────────────────────────────────

// process.cwd() = apps/web when script is run via pnpm
const LEARNING_DIR = path.join(process.cwd(), '../../learning')

function getProblemsDirs(learningDir: string): string[] {
  if (!fs.existsSync(learningDir)) return []
  return fs
    .readdirSync(learningDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(learningDir, d.name, 'problems'))
    .filter((d) => fs.existsSync(d))
}

// ── Enum mappings ─────────────────────────────────────────────────────────────

function mapDifficulty(d: ProblemFrontmatter['difficulty']): Difficulty {
  return { easy: Difficulty.EASY, medium: Difficulty.MEDIUM, hard: Difficulty.HARD }[d]
}

function mapStatus(s: ProblemFrontmatter['status']): ProblemStatus {
  return s === 'published' ? ProblemStatus.PUBLISHED : ProblemStatus.DRAFT
}

function mapRuntime(r: ProblemFrontmatter['runtime']): ExecutionRuntime {
  if (r === 'cuda') return ExecutionRuntime.CUDA
  if (r === 'k8s') return ExecutionRuntime.K8S
  return ExecutionRuntime.CPP
}

function mapCppStandard(s: ProblemFrontmatter['cpp_standard']): CppStandard {
  const map: Record<string, CppStandard> = {
    '14': CppStandard.CPP14,
    '17': CppStandard.CPP17,
    '20': CppStandard.CPP20,
    '23': CppStandard.CPP23,
  }
  return (s ? map[s] : undefined) ?? CppStandard.CPP17
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const problemsDirs = getProblemsDirs(LEARNING_DIR)
  console.log('\nScanning learning directory...')
  console.log(`  ${LEARNING_DIR}\n`)

  const allValid: Awaited<ReturnType<typeof scanProblems>>['valid'] = []
  const allWarnings: Awaited<ReturnType<typeof scanProblems>>['warnings'] = []

  for (const dir of problemsDirs) {
    const { valid, warnings } = await scanProblems(dir)
    allValid.push(...valid)
    allWarnings.push(...warnings)
  }

  const total = allValid.length + allWarnings.length
  console.log(`Found ${total} MDX file(s)\n`)

  // Print valid files
  for (const { filePath } of allValid) {
    const rel = path.relative(LEARNING_DIR, filePath)
    const dir = path.dirname(rel)
    console.log(`  ✓ ${dir}`)
  }

  // Print warnings
  for (const { filePath, errors } of allWarnings) {
    const rel = path.relative(LEARNING_DIR, filePath)
    const dir = path.dirname(rel)
    for (const err of errors) {
      console.warn(`  ⚠ ${dir} — ${err} (skipped)`)
    }
  }

  if (allValid.length === 0 && allWarnings.length === 0) {
    console.log('  (no MDX files found)')
  }

  console.log('\nSyncing to database...')

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

  let upserted = 0
  let skipped = allWarnings.length

  try {
    // Build track slug → id map
    const tracks = await prisma.track.findMany({ select: { id: true, slug: true } })
    const trackMap = new Map(tracks.map((t) => [t.slug, t.id]))

    for (const { frontmatter: fm, filePath } of allValid) {
      const trackId = trackMap.get(fm.track)
      if (!trackId) {
        const rel = path.relative(LEARNING_DIR, filePath)
        console.warn(`  ⚠ ${path.dirname(rel)} — unknown track '${fm.track}' (skipped)`)
        skipped++
        continue
      }

      const data = {
        title:            fm.title,
        difficulty:       mapDifficulty(fm.difficulty),
        trackId,
        tags:             fm.tags,
        status:           mapStatus(fm.status),
        xpReward:         fm.xp,
        executionRuntime: mapRuntime(fm.runtime),
        cppStandard:      mapCppStandard(fm.cpp_standard),
        cudaMinVersion:   fm.cuda_min_version ?? null,
        computeMinCap:    fm.compute_min_cap ?? null,
      }

      await prisma.problem.upsert({
        where:  { slug: fm.slug },
        update: data,
        create: { slug: fm.slug, ...data },
      })

      upserted++
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log(`  upserted: ${upserted} problems`)
  console.log(`  skipped:  ${skipped} problems (warnings above)`)
  console.log('\nSync complete.\n')

  // Write stats.json for landing page
  const prismaForStats = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })
  try {
    const stats = {
      totalProblems: await prismaForStats.problem.count({ where: { status: 'PUBLISHED' } }),
      totalTracks:   await prismaForStats.track.count(),
      totalTheory:   await prismaForStats.roadmapNode.count({ where: { type: 'CONCEPT' } }),
      totalArticles: await prismaForStats.roadmapNode.count({ where: { type: 'ARTICLE' } }),
      generatedAt:   new Date().toISOString(),
    }
    const statsPath = path.join(process.cwd(), 'public', 'stats.json')
    await fsPromises.writeFile(statsPath, JSON.stringify(stats, null, 2))
    console.log(`Stats written to public/stats.json\n`)
  } finally {
    await prismaForStats.$disconnect()
  }

  if (allWarnings.length > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
