import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { loadTheoryContent, extractHeadings, addHeadingIds } from '@/lib/theory-content'
import { MarkReadButton } from './MarkReadButton'
import type { Metadata } from 'next'

type TrackNode = Awaited<ReturnType<typeof prisma.roadmapNode.findMany>>[number]

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LearnPage({ params }: Props) {
  const { slug } = await params

  const session = await auth()

  const node = await prisma.roadmapNode.findUnique({
    where: { slug },
    include: { track: true },
  })

  if (!node || (node.type !== 'CONCEPT' && node.type !== 'ARTICLE')) notFound()

  const [trackNodes, content, existingRead] = await Promise.all([
    prisma.roadmapNode.findMany({
      where: { trackId: node.trackId, type: { in: ['CONCEPT', 'ARTICLE'] } },
      orderBy: { order: 'asc' },
    }),
    loadTheoryContent(node.track.slug, slug, node.type),
    session?.user?.id
      ? prisma.conceptRead.findUnique({
          where: { userId_nodeSlug: { userId: session.user.id, nodeSlug: slug } },
        })
      : null,
  ])

  const isRead = existingRead !== null

  const currentIndex = trackNodes.findIndex((n: TrackNode) => n.slug === slug)
  const prevNode = currentIndex > 0 ? trackNodes[currentIndex - 1] : null
  const nextNode = currentIndex < trackNodes.length - 1 ? trackNodes[currentIndex + 1] : null

  const headings = content ? extractHeadings(content.contentHtml) : []
  const contentHtml = content ? addHeadingIds(content.contentHtml) : null

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* Left sidebar — track nav */}
          <aside className="hidden lg:flex flex-col w-48 shrink-0">
            <div className="sticky top-8">
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-3 px-2"
                style={{ color: node.track.color }}
              >
                {node.track.title}
              </div>
              <nav className="flex flex-col gap-1">
                {trackNodes.map((n: TrackNode) => (
                  <Link
                    key={n.id}
                    href={`/learn/${n.slug}`}
                    className={[
                      'px-2 py-1.5 rounded text-sm transition-colors leading-snug',
                      n.slug === slug
                        ? 'font-semibold text-slate-900 bg-slate-100'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {n.title}
                  </Link>
                ))}
              </nav>

              {/* Prev / Next */}
              <div className="mt-6 flex flex-col gap-2">
                {prevNode && (
                  <Link
                    href={`/learn/${prevNode.slug}`}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <span>←</span>
                    <span className="truncate">{prevNode.title}</span>
                  </Link>
                )}
                {nextNode && (
                  <Link
                    href={`/learn/${nextNode.slug}`}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <span className="truncate">{nextNode.title}</span>
                    <span>→</span>
                  </Link>
                )}
              </div>
            </div>
          </aside>

          {/* Center content */}
          <main className="flex-1 min-w-0 max-w-2xl">

            {/* Mobile prev/next */}
            <div className="lg:hidden flex items-center justify-between mb-4 text-sm text-slate-500">
              {prevNode ? (
                <Link href={`/learn/${prevNode.slug}`} className="hover:text-slate-900">
                  ← {prevNode.title}
                </Link>
              ) : <span />}
              {nextNode ? (
                <Link href={`/learn/${nextNode.slug}`} className="hover:text-slate-900">
                  {nextNode.title} →
                </Link>
              ) : <span />}
            </div>

            {/* Mobile ToC dropdown */}
            {headings.length > 0 && (
              <details className="lg:hidden mb-6 border border-slate-200 rounded-lg p-3">
                <summary className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  On this page
                </summary>
                <nav className="mt-3 flex flex-col gap-1">
                  {headings.map((h: { id: string; text: string; level: 2 | 3 }) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={[
                        'text-sm text-slate-500 hover:text-slate-900',
                        h.level === 3 ? 'pl-3' : '',
                      ].join(' ')}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </details>
            )}

            {/* Page title */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-3xl font-bold text-slate-900 leading-tight">
                {node.title}
              </h1>
              <div className="shrink-0 mt-1">
                <MarkReadButton slug={slug} isRead={isRead} />
              </div>
            </div>

            {/* Tags */}
            {content?.meta.tags && content.meta.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {content.meta.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            {contentHtml ? (
              <div
                className="theory-content"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                <p className="text-slate-500 text-sm">Content coming soon.</p>
                <p className="text-slate-400 text-xs mt-1">{node.description}</p>
              </div>
            )}
          </main>

          {/* Right sidebar — Table of contents */}
          {headings.length > 0 && (
            <aside className="hidden xl:block w-48 shrink-0">
              <div className="sticky top-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  On this page
                </p>
                <nav className="flex flex-col gap-1">
                  {headings.map((h: { id: string; text: string; level: 2 | 3 }) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={[
                        'text-xs text-slate-500 hover:text-slate-900 transition-colors leading-snug',
                        h.level === 3 ? 'pl-3' : '',
                      ].join(' ')}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const node = await prisma.roadmapNode.findUnique({
    where: { slug },
    select: { title: true, description: true },
  })
  if (!node) return {}
  return {
    title: `${node.title} — leetscuda.com`,
    description: node.description,
  }
}
