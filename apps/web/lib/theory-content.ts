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

  let html = marked(source) as string
  html = postProcess(html)
  return html
}

/**
 * Post-process rendered HTML to add rich visual treatments:
 * - Wrap <table> in scroll container
 * - Wrap <pre> blocks with copy button
 * - Transform ❌ Wrong / ✓ Correct paragraphs into colored cards
 * - Transform **Q: ...** paragraphs into interview question blocks
 * - Wrap "Why this matters" section first paragraph in callout
 */
function postProcess(html: string): string {
  // 1. Wrap tables in scroll container
  html = html
    .replace(/<table/g, '<div class="table-wrapper"><table')
    .replace(/<\/table>/g, '</table></div>')

  // 2. Wrap pre blocks with copy button
  // The renderer outputs: <pre><code class="hljs ...">...</code></pre>
  html = html.replace(
    /<pre><code([\s\S]*?)>([\s\S]*?)<\/code><\/pre>/g,
    (_match, attrs, code) => `<div class="code-block-wrapper"><button class="copy-code-btn" onclick="(function(btn){var code=btn.closest('.code-block-wrapper').querySelector('code');navigator.clipboard.writeText(code.innerText).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)})})(this)">Copy</button><pre><code${attrs}>${code}</code></pre></div>`,
  )

  // 3. Transform ❌ Wrong / ✓ Correct patterns
  // marked renders: <p>❌ <strong>Wrong</strong>: ...</p>
  html = html
    .replace(
      /<p>❌\s*<strong>Wrong<\/strong>:([\s\S]*?)<\/p>/g,
      '<div class="misconception-wrong"><span class="misconception-icon">✕</span><div class="misconception-body"><strong>Common mistake</strong>$1</div></div>',
    )
    .replace(
      /<p>✓\s*<strong>Correct<\/strong>:([\s\S]*?)<\/p>/g,
      '<div class="misconception-correct"><span class="misconception-icon">✓</span><div class="misconception-body"><strong>Correct understanding</strong>$1</div></div>',
    )

  // 4. Transform **Q: ...** paragraphs into interview question blocks
  // marked renders: <p><strong>Q: question text</strong></p>
  // or: <p><strong>Q: question text</strong> answer text</p>
  html = html.replace(
    /<p><strong>Q:\s*(.*?)<\/strong>([\s\S]*?)<\/p>/g,
    '<div class="interview-question"><div class="interview-q-label">Interview Q</div><div class="interview-q-text"><strong>$1</strong>$2</div></div>',
  )

  // 5. Wrap first paragraph after "Why this matters" h2 in callout
  html = html.replace(
    /(<h2[^>]*>[^<]*[Ww]hy this matters[^<]*<\/h2>\s*)(<p>[\s\S]*?<\/p>)/,
    '$1<div class="why-matters-callout">$2</div>',
  )

  return html
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
