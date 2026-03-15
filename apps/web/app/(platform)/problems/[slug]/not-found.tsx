import Link from 'next/link'

export default function ProblemNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-slate-400 text-sm font-mono mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Problem not found</h1>
        <p className="text-slate-600 text-sm mb-8">
          This problem doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/problems"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Browse problems
        </Link>
      </div>
    </main>
  )
}
