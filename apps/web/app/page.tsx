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
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-white border-b border-slate-200 overflow-hidden">
        {/* Subtle background decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% -10%, rgba(219,234,254,0.55) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-slate-900">
              The interview prep platform for AI infrastructure engineers
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed">
              CUDA, ML systems, Kubernetes for AI, and the algorithms underneath.
              One platform. No fluff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/problems"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow-md transition-all duration-150"
              >
                Start practicing
              </Link>
              <Link
                href="/roadmap"
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium shadow-sm transition-all duration-150"
              >
                View roadmap
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-8">
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tabular-nums">12</span>
                <span className="text-sm text-slate-500 mt-0.5">problems</span>
              </div>
              <div className="w-px bg-slate-200 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tabular-nums">4</span>
                <span className="text-sm text-slate-500 mt-0.5">tracks</span>
              </div>
              <div className="w-px bg-slate-200 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900">Principal-level</span>
                <span className="text-sm text-slate-500 mt-0.5">interview depth</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              LeetCode won&apos;t get you this job
            </h2>
            <div className="mt-6 space-y-4 text-slate-700 leading-relaxed border-l-2 border-slate-300 pl-5">
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
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Four tracks. One coherent path.
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tracks.map((track) => (
              <div
                key={track.slug}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                style={{ borderLeft: `3px solid ${track.color}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold text-slate-900 leading-snug">
                    {track.title}
                  </h3>
                  <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {track.count} problems
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{track.description}</p>
                <Link
                  href={`/problems?track=${track.slug}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors mt-auto group"
                >
                  Explore <span className="inline-block transition-transform duration-150 group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                n: '1',
                title: 'Follow the roadmap',
                body: 'Start from the visual dependency graph. Understand what to learn and in what order before you write a single line of code.',
              },
              {
                n: '2',
                title: 'Solve real problems',
                body: 'Problems modeled after actual interview questions at AI infrastructure companies. Not toy examples — the real depth.',
              },
              {
                n: '3',
                title: 'Track your progress',
                body: 'XP, streaks, and per-track completion so you always know exactly where you stand and what to work on next.',
              },
            ].map((step) => (
              <div key={step.n} className="flex flex-col gap-3">
                <span className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center ring-4 ring-blue-100 shadow-sm">
                  {step.n}
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Ready to actually prepare?
            </h2>
            <p className="mt-4 text-slate-400">
              Free to use. No credit card. Just sign in with GitHub or Google.
            </p>
            <Link
              href="/api/auth/signin"
              className="mt-8 inline-block px-6 py-3 rounded-lg bg-white text-slate-900 hover:bg-slate-100 font-medium shadow-lg hover:shadow-xl transition-all duration-150"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center gap-4 text-sm text-slate-500">
          <p>leetscuda.com — built for the interview nobody warns you about</p>
          <div className="flex items-center gap-5">
            <a
              href="#"
              className="hover:text-slate-700 transition-colors"
            >
              GitHub
            </a>
            <Link href="/roadmap" className="hover:text-slate-700 transition-colors">
              Roadmap
            </Link>
            <Link href="/problems" className="hover:text-slate-700 transition-colors">
              Problems
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
