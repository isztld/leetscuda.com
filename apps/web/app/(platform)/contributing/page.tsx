import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contributing — leetscuda.com',
}

export default function ContributingPage() {
  return (
    <article className="max-w-2xl mx-auto py-16 px-6 prose prose-slate">
      <h1>Contributing</h1>
      <p>
        The leetscuda curriculum is open source. Problems, theory articles, and track structures
        live in the{' '}
        <a
          href="https://github.com/isztld/leetscuda.com/tree/master/learning"
          target="_blank"
          rel="noopener noreferrer"
        >
          learning/ directory on GitHub
        </a>{' '}
        under <code>learning/</code>, licensed MIT. Community contributions are welcome and
        credited.
      </p>

      <p>
        Read the{' '}
        <a
          href="https://github.com/isztld/leetscuda.com/blob/master/learning/README.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          contribution guide
        </a>{' '}
        for full frontmatter schema, content standards, and examples. Report bugs or request
        problems via{' '}
        <a
          href="https://github.com/isztld/leetscuda.com/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Issues
        </a>
        .
      </p>

      <h2>Adding a problem</h2>
      <ol>
        <li>
          Fork{' '}
          <a
            href="https://github.com/isztld/leetscuda.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/isztld/leetscuda.com
          </a>
        </li>
        <li>
          Create <code>learning/&#123;track&#125;/problems/&#123;slug&#125;/index.mdx</code>
        </li>
        <li>
          Follow the frontmatter schema (see an existing problem for reference — e.g.{' '}
          <code>learning/cuda/problems/coalesced-access/index.mdx</code>)
        </li>
        <li>Write description, starter code, test cases, solution, and editorial sections</li>
        <li>
          Run <code>pnpm db:sync</code> locally to validate the MDX parses correctly
        </li>
        <li>Open a PR — CI validates frontmatter automatically</li>
        <li>On merge, the problem goes live within minutes</li>
      </ol>

      <h2>Adding theory content</h2>
      <ol>
        <li>
          Create{' '}
          <code>learning/&#123;track&#125;/theory/&#123;slug&#125;/index.mdx</code>
        </li>
        <li>
          The slug must match a <code>CONCEPT</code> node in{' '}
          <code>learning/&#123;track&#125;/track.mdx</code>
        </li>
        <li>
          Run <code>pnpm theory:sync</code> to validate coverage
        </li>
        <li>Open a PR</li>
      </ol>

      <h2>Adding a track node</h2>
      <ol>
        <li>
          Edit <code>learning/&#123;track&#125;/track.mdx</code>
        </li>
        <li>
          Add the node definition with <code>slug</code>, <code>title</code>, <code>type</code>,
          and <code>prerequisites</code>
        </li>
        <li>Create the corresponding content file at the matching path</li>
      </ol>

      <h2>Content standards</h2>
      <ul>
        <li>Problems must have real test cases with correct expected outputs</li>
        <li>
          CUDA problems must compile cleanly with{' '}
          <code>nvcc -arch=sm_86</code>
        </li>
        <li>
          Kubernetes problems must pass{' '}
          <code>kubectl apply --dry-run=client</code>
        </li>
        <li>Theory content must be technically accurate — cite sources where appropriate</li>
        <li>
          No AI-generated filler — write as a practitioner who has worked with the thing being
          described
        </li>
      </ul>

      <h2>Code of conduct</h2>
      <p>
        Be welcoming and professional. Contributions from all experience levels are valued. Critique
        technical content on its merits, not the contributor. Harassment of any kind will result in
        removal from the project.
      </p>

      <h2>Questions</h2>
      <p>
        Open a{' '}
        <a
          href="https://github.com/isztld/leetscuda.com/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub issue
        </a>{' '}
        or see the <a href="/faq">FAQ</a>.
      </p>
    </article>
  )
}
