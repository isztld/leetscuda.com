import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — leetscuda.com',
}

export default function AboutPage() {
  return (
    <article className="max-w-2xl mx-auto py-16 px-6 prose prose-slate">
      <h1>About leetscuda.com</h1>

      <h2>The gap</h2>
      <p>
        Companies like Nebius, Groq, Lambda Labs, Crusoe, and the major AI labs are hiring for
        infrastructure roles that go well beyond what LeetCode prepares you for. These aren&apos;t
        generic software engineering interviews. They want engineers who can reason about GPU memory
        coalescing, explain KV cache eviction policies, write a CUDA reduction kernel and identify
        its bottlenecks, and diagnose why a training job pod gets OOMKilled on a node with free
        VRAM.
      </p>
      <p>
        When preparing for these interviews, I found nothing adequate. The CUDA documentation is
        dense and academic, written for people already working in the field. ML systems papers assume
        you already understand the internals they&apos;re improving. Kubernetes documentation does
        not cover GPU workloads at any useful depth. Everything exists in isolation, and none of it
        is structured around interview questions. LeetCode solves a different problem.
      </p>
      <p>
        The gap is real. Senior engineers who are strong on general systems and algorithms still need
        six to twelve months of focused study to be competitive for principal-level AI infrastructure
        roles. There was no single place to do that study systematically.
      </p>

      <h2>The platform</h2>
      <p>
        leetscuda.com is structured around four tracks: CUDA and GPU programming, ML systems and
        inference, Kubernetes for AI, and systems foundations. Each track has a dependency graph —
        you follow the roadmap to build the mental model before you try the problems.
      </p>
      <p>
        Problems are modeled after questions I encountered at actual AI infrastructure companies.
        They compile and run in an isolated sandbox. You get real feedback: what compiled, what
        failed, what the expected output was. Theory articles provide the context you need to
        understand why the answer is what it is, not just that it is.
      </p>

      <h2>The content</h2>
      <p>
        The entire curriculum is open source under the{' '}
        <a
          href="https://github.com/[YOUR_USERNAME]/leetscuda"
          target="_blank"
          rel="noopener noreferrer"
        >
          learning/ directory on GitHub
        </a>
        , licensed MIT. Problems, theory articles, and track structures are written in MDX and
        contributed via pull request. If you find an error or want to add a problem, open a PR.
      </p>

      <h2>The founder</h2>
      <p>
        I&apos;m [YOUR NAME]. I work in AI infrastructure. I built this platform after spending
        months preparing for roles at AI companies and finding no adequate single resource. The
        platform is the resource I wish had existed.
      </p>
      <p>
        I built it in the open because the problems it covers are genuinely hard, the field moves
        fast, and no single person can keep up with all of it. Community contributions make the
        content better for everyone.
      </p>

      <h2>Get involved</h2>
      <ul>
        <li>
          <Link href="/contributing">Contributing guide</Link> — how to add problems and theory
          content
        </li>
        <li>
          <a
            href="https://github.com/[YOUR_USERNAME]/leetscuda"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>{' '}
          — source code and issue tracker
        </li>
        <li>
          <Link href="/faq">FAQ</Link> — common questions
        </li>
        <li>
          <Link href="/support">Support the project</Link> — help cover GPU server costs
        </li>
      </ul>
    </article>
  )
}
