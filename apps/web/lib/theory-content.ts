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

  // 3a. Split paragraphs where no blank line existed between misconception markers —
  // marked merges them into one <p> with \n between entries.
  // Two formats exist:
  //   **❌ Wrong:** text  → \n<strong>❌ ...  (emoji inside bold)
  //   ❌ **Wrong:** text  → \n❌ ...          (emoji outside bold)
  // Split at any newline followed by ❌ or ✓ (either directly or inside <strong>).
  html = html.replace(/\n([❌✓])/g, '</p>\n<p>$1')
  html = html.replace(/\n(<strong>[❌✓])/g, '</p>\n<p>$1')

  // 3. Transform ❌ Wrong / ✓ Correct patterns — two variants:
  // Variant A: ❌ **Wrong**: ... → <p>❌ <strong>Wrong</strong>: ...</p>
  // Variant B: **❌ Wrong:** ... → <p><strong>❌ Wrong:</strong> ...</p>
  html = html
    .replace(
      /<p>❌\s*<strong>Wrong[^<]*<\/strong>:?\s*([\s\S]*?)<\/p>/g,
      '<div class="misconception-wrong"><span class="misconception-icon">✕</span><div class="misconception-body"><strong>Common mistake</strong> $1</div></div>',
    )
    .replace(
      /<p><strong>❌\s*Wrong[^<]*<\/strong>:?\s*([\s\S]*?)<\/p>/g,
      '<div class="misconception-wrong"><span class="misconception-icon">✕</span><div class="misconception-body"><strong>Common mistake</strong> $1</div></div>',
    )
    .replace(
      /<p>✓\s*<strong>Correct[^<]*<\/strong>:?\s*([\s\S]*?)<\/p>/g,
      '<div class="misconception-correct"><span class="misconception-icon">✓</span><div class="misconception-body"><strong>Correct understanding</strong> $1</div></div>',
    )
    .replace(
      /<p><strong>✓\s*Correct[^<]*<\/strong>:?\s*([\s\S]*?)<\/p>/g,
      '<div class="misconception-correct"><span class="misconception-icon">✓</span><div class="misconception-body"><strong>Correct understanding</strong> $1</div></div>',
    )

  // 4. Transform **Question [N]**: / **Answer**: pairs into interview question blocks.
  //
  // The actual MDX format is:
  //   **Question 1**: "question text"       → <p><strong>Question 1</strong>: "question text"</p>
  //   **Answer**: answer text               → <p><strong>Answer</strong>: answer text</p>
  //
  // Two cases:
  //   4a. Q paragraph + A paragraph with inline answer → collapsible <details>
  //   4b. Lone Q paragraph (multi-element answer follows as list/code) → styled Q block only

  // 4a: Pair adjacent Q + inline-A paragraphs — answer has content on same line
  const answerLabels = 'Answer|Expected answer|Expected diagnostic|Answer framework'
  html = html.replace(
    new RegExp(
      `<p><strong>(Question[^<]*?)<\\/strong>:(.*?)<\\/p>\\n<p><strong>(?:${answerLabels})[^<]*?<\\/strong>:(.+?)<\\/p>`,
      'g',
    ),
    (_match, _qLabel, qText, aText) => {
      const question = qText.trim()
      const answer = aText.trim()
      return `<div class="interview-question"><div class="interview-q-label">Interview Q</div><div class="interview-q-text">${question}</div><details class="interview-answer"><summary>Show answer</summary><div class="interview-answer-body"><p>${answer}</p></div></details></div>`
    },
  )

  // 4b: Lone Q paragraphs whose answers are multi-element (list/code follows separately)
  html = html.replace(
    /<p><strong>Question[^<]*?<\/strong>:(.*?)<\/p>/g,
    (_match, text) =>
      `<div class="interview-question"><div class="interview-q-label">Interview Q</div><div class="interview-q-text">${text.trim()}</div></div>`,
  )

  // 4d: **Pattern N — title.** content — interview pattern blocks (all visible, no toggle)
  // marked renders: <p><strong>Pattern N — title.</strong> content</p>
  html = html.replace(
    /<p><strong>(Pattern[^<]+?)<\/strong>(.*?)<\/p>/g,
    (_match, title, content) =>
      `<div class="interview-question"><div class="interview-q-label">Interview Pattern</div><div class="interview-q-text"><strong>${title.trim()}</strong>${content}</div></div>`,
  )

  // 4c: Answer-label-only paragraphs (label with no inline content, multi-element answer follows)
  html = html.replace(
    new RegExp(`<p><strong>(?:${answerLabels})[^<]*?<\\/strong>:<\\/p>`, 'g'),
    '<div class="interview-a-label">Answer</div>',
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
