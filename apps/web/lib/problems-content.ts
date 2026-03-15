import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'

// marked and highlight.js are ESM-only; loaded at call time via dynamic import
// (Next.js serverExternalPackages ensures they run through Node's native import())
async function renderMarkdown(source: string): Promise<string> {
  const { marked, Renderer } = await import('marked')
  const hljs = (await import('highlight.js')).default

  const renderer = new Renderer()
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    const highlighted = hljs.highlight(text, { language }).value
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
  }
  marked.use({ renderer })

  return marked(source) as string
}

// process.cwd() is apps/web when running `next dev`
const PROBLEMS_DIR = path.join(process.cwd(), '../../problems')

export type TestCase = {
  name: string
  input: string
  expected: string
}

export type ProblemMeta = {
  slug: string
  title: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  track: string
  tags: string[]
  execution: string
  status: string
  xp: number
}

export type ProblemContent = {
  meta: ProblemMeta
  descriptionHtml: string
  starterCode: string
  testCases: TestCase[]
}

export async function loadProblemContent(
  trackSlug: string,
  problemSlug: string,
): Promise<ProblemContent> {
  const filePath = path.join(PROBLEMS_DIR, trackSlug, problemSlug, 'index.mdx')

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    throw new Error(`Problem content not found: ${trackSlug}/${problemSlug}`)
  }

  const { data, content } = matter(raw)

  // Split body on section delimiters
  const [descPart = '', rest1 = ''] = content.split('---starter-code---')
  const [starterPart = '', rest2 = ''] = rest1.split('---test-cases---')
  const [testCasesPart = ''] = rest2.split('---solution---')

  const descriptionHtml = await renderMarkdown(descPart.trim())

  // Parse test cases YAML
  let testCases: TestCase[] = []
  const trimmed = testCasesPart.trim()
  if (trimmed) {
    try {
      testCases = yaml.load(trimmed) as TestCase[]
    } catch {
      testCases = []
    }
  }

  return {
    meta: data as ProblemMeta,
    descriptionHtml,
    starterCode: starterPart.trim(),
    testCases,
  }
}
