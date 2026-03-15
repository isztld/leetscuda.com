import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { type ProblemFrontmatter, validateFrontmatter } from './validate-frontmatter'

export type ScannedProblem = {
  filePath: string
  frontmatter: ProblemFrontmatter
}

export type ScanResult = {
  valid: ScannedProblem[]
  warnings: { filePath: string; errors: string[] }[]
}

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

export async function scanProblems(problemsDir: string): Promise<ScanResult> {
  const valid: ScannedProblem[] = []
  const warnings: { filePath: string; errors: string[] }[] = []

  const files = findMdxFiles(problemsDir)

  for (const filePath of files) {
    let raw: string
    try {
      raw = fs.readFileSync(filePath, 'utf8')
    } catch {
      warnings.push({ filePath, errors: [`Cannot read file`] })
      continue
    }

    const { data } = matter(raw)

    // Validate frontmatter
    const validation = validateFrontmatter(data as Record<string, unknown>, filePath)
    if (!validation.valid) {
      warnings.push({ filePath, errors: validation.errors })
      continue
    }

    // Slug consistency: frontmatter slug must match directory name
    const dirSlug = path.basename(path.dirname(filePath))
    if (validation.data.slug !== dirSlug) {
      warnings.push({
        filePath,
        errors: [
          `slug '${validation.data.slug}' does not match directory name '${dirSlug}'`,
        ],
      })
      continue
    }

    valid.push({ filePath, frontmatter: validation.data })
  }

  return { valid, warnings }
}
