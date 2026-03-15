import Link from 'next/link'
import { Navbar } from '@/components/Navbar'

const tracks = [
  {
    slug: 'cuda',
    title: 'CUDA & GPU Programming',
    color: '#7C3AED',
    description:
      'Start here. Memory models, kernel optimization, and the threading primitives everything else builds on.',
    count: 10,
  },
  {
    slug: 'ml-systems',
    title: 'ML Systems & Inference',
    color: '#0891B2',
    description:
      'KV cache, flash attention, quantization, and continuous batching. The internals of modern inference.',
    count: 8,
  },
  {
    slug: 'kubernetes-ai',
    title: 'Kubernetes for AI',
    color: '#059669',
    description:
      'GPU scheduling, resource limits, multi-node training jobs. What production AI infra actually looks like.',
    count: 6,
  },
  {
    slug: 'foundations',
    title: 'Foundations',
    color: '#D97706',
    description:
      'PCIe bandwidth, roofline model, cache behavior. The systems fundamentals that separate good answers from great ones.',
    count: 10,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            The interview prep platform for AI infrastructure engineers
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 leading-relaxed">
            CUDA, ML systems, Kubernetes for AI, and the algorithms underneath.
            One platform. No fluff.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/problems"
              className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              Start practicing
            </Link>
            <Link
              href="/roadmap"
              className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium border border-zinc-700 transition-colors"
            >
              View roadmap
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">12</span>
              <span className="text-sm text-zinc-500 mt-0.5">problems</span>
            </div>
            <div className="w-px bg-zinc-800 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">4</span>
              <span className="text-sm text-zinc-500 mt-0.5">tracks</span>
            </div>
            <div className="w-px bg-zinc-800 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">Principal-level</span>
              <span className="text-sm text-zinc-500 mt-0.5">interview depth</span>
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">
              LeetCode won&apos;t get you this job
            </h2>
            <div className="mt-6 space-y-4 text-zinc-400 leading-relaxed">
              <p>
                Companies like Nebius, Groq, and Lambda Labs are now interviewing for AI
                infrastructure roles that go well beyond two-sum and system design. They want
                engineers who understand memory coalescing in CUDA kernels, can reason about
                KV cache eviction policies, and know why your pod is getting OOMKilled on a
                GPU node. That&apos;s a very different interview than LeetCode prepares you for.
              </p>
              <p>
                I spent months preparing for these roles and found nothing. The CUDA
                documentation is dense and academic. ML systems papers assume you already know
                the internals. Kubernetes docs don&apos;t cover GPU workloads at any useful depth.
                Every resource exists in isolation, and none of them are structured around
                interview questions.
              </p>
              <p>
                This platform exists because the gap is real. Problems are modeled after
                questions I&apos;ve seen at actual AI infrastructure companies, organized into a
                learning path that builds the mental model you need — not just the syntax.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight">
            Four tracks. One coherent path.
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tracks.map((track) => (
              <div
                key={track.slug}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3"
                style={{ borderLeft: `3px solid ${track.color}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {track.title}
                  </h3>
                  <span className="shrink-0 text-xs font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {track.count} problems
                  </span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{track.description}</p>
                <Link
                  href={`/problems?track=${track.slug}`}
                  className="text-sm text-zinc-400 hover:text-white transition-colors mt-auto"
                >
                  Explore →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
                Step 1
              </span>
              <h3 className="text-lg font-semibold text-white">Follow the roadmap</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Start from the visual dependency graph. Understand what to learn and in what
                order before you write a single line of code.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
                Step 2
              </span>
              <h3 className="text-lg font-semibold text-white">Solve real problems</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Problems modeled after actual interview questions at AI infrastructure
                companies. Not toy examples — the real depth.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
                Step 3
              </span>
              <h3 className="text-lg font-semibold text-white">Track your progress</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                XP, streaks, and per-track completion so you always know exactly where you
                stand and what to work on next.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-8 py-12 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to actually prepare?
            </h2>
            <p className="mt-4 text-zinc-400">
              Free to use. No credit card. Just sign in with GitHub or Google.
            </p>
            <Link
              href="/api/auth/signin"
              className="mt-8 inline-block px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center gap-4 text-sm text-zinc-500">
          <p>leetscuda.com — built for the interview nobody warns you about</p>
          <div className="flex items-center gap-5">
            <a
              href="#"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <Link href="/roadmap" className="hover:text-zinc-300 transition-colors">
              Roadmap
            </Link>
            <Link href="/problems" className="hover:text-zinc-300 transition-colors">
              Problems
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
