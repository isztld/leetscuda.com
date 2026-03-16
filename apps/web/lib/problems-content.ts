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
const LEARNING_DIR = path.join(process.cwd(), '../../learning')

export type TestCase = {
  name: string
  input: string
  expected: string
}

export type K8sCheck = {
  id: string
  description: string
  type: 'schema' | 'assertion' | 'kubectl-dry-run'
  assert?: Record<string, unknown>
  path?: string
  op?: string
  value?: unknown
}

export type ProblemContent = {
  descriptionHtml: string
  starterCode: string
  testCases: TestCase[]
  harness: string
  editorial: string | null
  k8sChecks: K8sCheck[]
}

export async function loadProblemContent(
  trackSlug: string,
  problemSlug: string,
): Promise<ProblemContent> {
  const filePath = path.join(LEARNING_DIR, trackSlug, 'problems', problemSlug, 'index.mdx')

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    throw new Error(`Problem content not found: ${trackSlug}/${problemSlug}`)
  }

  const { content } = matter(raw)

  // Split body on section delimiters
  const [descPart = '', rest1 = ''] = content.split('---starter-code---')

  // Detect K8s vs cpp/cuda by presence of k8s-checks delimiter
  const isK8s = rest1.includes('---k8s-checks---')

  let starterPart = ''
  let testCases: TestCase[] = []
  let harness = ''
  let k8sChecks: K8sCheck[] = []

  if (isK8s) {
    const [starter = '', rest2 = ''] = rest1.split('---k8s-checks---')
    starterPart = starter
    const [checksPart = ''] = rest2.split('---solution---')
    const trimmed = checksPart.trim()
    if (trimmed) {
      try {
        k8sChecks = yaml.load(trimmed) as K8sCheck[]
        if (!Array.isArray(k8sChecks)) k8sChecks = []
      } catch {
        k8sChecks = []
      }
    }
  } else {
    const [starter = '', rest2 = ''] = rest1.split('---test-cases---')
    starterPart = starter
    const [testCasesPart = '', rest3 = ''] = rest2.split('---solution---')
    const [, rest4 = ''] = rest3.split('---harness---')
    harness = rest4.split('---editorial---')[0]

    const trimmed = testCasesPart.trim()
    if (trimmed) {
      try {
        testCases = yaml.load(trimmed) as TestCase[]
      } catch {
        testCases = []
      }
    }
  }

  // Search for editorial anywhere after the solution section
  const editorialMarkerIdx = content.indexOf('---editorial---')
  let editorialContent = ''
  if (editorialMarkerIdx !== -1) {
    const afterMarker = content.slice(editorialMarkerIdx + '---editorial---'.length)
    editorialContent = afterMarker.split('---end---')[0].trim()
  }

  const descriptionHtml = await renderMarkdown(descPart.trim())

  const editorial = editorialContent
    ? await renderMarkdown(editorialContent)
    : null

  return {
    descriptionHtml,
    starterCode: starterPart.trim(),
    testCases,
    harness: harness.trim(),
    editorial,
    k8sChecks,
  }
}
