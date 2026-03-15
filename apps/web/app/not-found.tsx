import Link from 'next/link'

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-zinc-500 text-sm font-mono mb-2">404</p>
        <h1 className="text-2xl font-bold mb-3">Page not found</h1>
        <p className="text-zinc-400 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}
