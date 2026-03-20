import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

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

export type TheoryFrontmatter = {
  slug: string
  title: string
  track: string
  type: 'concept' | 'article'
  tags?: string[]
  status: 'published' | 'draft'
  author?: string
}

export type TheoryContent = {
  meta: TheoryFrontmatter
  contentHtml: string
}

export async function loadTheoryContent(
  track: string,
  slug: string,
  nodeType: 'CONCEPT' | 'ARTICLE' = 'CONCEPT',
): Promise<TheoryContent | null> {
  // ARTICLE types look for content in articles/ folder, CONCEPT in theory/
  const folder = nodeType === 'ARTICLE' ? 'articles' : 'theory'
  const filePath = path.join(LEARNING_DIR, track, folder, slug, 'index.mdx')

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const { data, content } = matter(raw)
  const contentHtml = await renderMarkdown(content.trim())

  return {
    meta: data as TheoryFrontmatter,
    contentHtml,
  }
}

/** Extract H2/H3 headings from rendered HTML for table of contents */
export function extractHeadings(html: string): { id: string; text: string; level: 2 | 3 }[] {
  const headings: { id: string; text: string; level: 2 | 3 }[] = []
  const re = /<h([23])[^>]*>(.*?)<\/h[23]>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const level = parseInt(match[1]) as 2 | 3
    const raw = match[2].replace(/<[^>]+>/g, '').trim()
    const id = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    headings.push({ id, text: raw, level })
  }
  return headings
}

/** Add id attributes to headings in HTML for anchor links */
export function addHeadingIds(html: string): string {
  return html.replace(/<h([23])>(.*?)<\/h[23]>/gi, (_match, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}
