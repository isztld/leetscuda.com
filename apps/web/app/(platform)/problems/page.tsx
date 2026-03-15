import { Difficulty } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ProblemsClient } from '@/components/ProblemsClient'

export const metadata = {
  title: 'Problems — LeetsCUDA',
  description: 'Solve your way to an AI infrastructure role.',
}

const DIFFICULTY_VALUES = new Set<string>(['EASY', 'MEDIUM', 'HARD'])

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: { track?: string; difficulty?: string }
}) {
  const activeTrack = searchParams.track ?? null
  const activeDifficulty =
    searchParams.difficulty && DIFFICULTY_VALUES.has(searchParams.difficulty)
      ? (searchParams.difficulty as Difficulty)
      : null

  const [tracks, problems, session] = await Promise.all([
    prisma.track.findMany({ orderBy: { order: 'asc' } }),
    prisma.problem.findMany({
      where: {
        status: 'PUBLISHED',
        ...(activeTrack && { track: { slug: activeTrack } }),
        ...(activeDifficulty && { difficulty: activeDifficulty }),
      },
      include: { track: true },
      orderBy: [{ track: { order: 'asc' } }, { difficulty: 'asc' }],
    }),
    auth(),
  ])

  let solvedIds: string[] | null = null
  if (session?.user?.id) {
    const progress = await prisma.userProgress.findMany({
      where: { userId: session.user.id },
      select: { problemId: true },
    })
    solvedIds = progress.map((p) => p.problemId)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Problems</h1>
          <p className="text-zinc-400 mt-3 text-lg">
            Solve your way to an AI infrastructure role
          </p>
        </div>

        <ProblemsClient
          problems={problems}
          tracks={tracks}
          solvedIds={solvedIds}
          activeTrack={activeTrack}
          activeDifficulty={activeDifficulty}
        />
      </div>
    </main>
  )
}
