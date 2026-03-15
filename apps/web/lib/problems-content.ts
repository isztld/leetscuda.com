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

export type ProblemContent = {
  descriptionHtml: string
  starterCode: string
  testCases: TestCase[]
  harness: string
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

  const { content } = matter(raw)

  // Split body on section delimiters
  const [descPart = '', rest1 = ''] = content.split('---starter-code---')
  const [starterPart = '', rest2 = ''] = rest1.split('---test-cases---')
  const [testCasesPart = '', rest3 = ''] = rest2.split('---solution---')
  const [, harnessPart = ''] = rest3.split('---harness---')

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
    descriptionHtml,
    starterCode: starterPart.trim(),
    testCases,
    harness: harnessPart.trim(),
  }
}
