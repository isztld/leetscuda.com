import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { loadProblemContent } from '@/lib/problems-content'
import { ProblemDetail } from '@/components/ProblemDetail'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params

  const [problem, session] = await Promise.all([
    prisma.problem.findUnique({ where: { slug }, include: { track: true } }),
    auth(),
  ])

  if (!problem) notFound()

  // Fetch content + stats + isSolved in parallel
  const [content, totalAccepted, totalSubmissions, progress] = await Promise.all([
    loadProblemContent(problem.track.slug, problem.slug).catch(() => null),
    prisma.submission.count({ where: { problemId: problem.id, status: 'ACCEPTED' } }),
    prisma.submission.count({ where: { problemId: problem.id, status: { not: 'CANCELLED' } } }),
    session?.user?.id
      ? prisma.userProgress.findUnique({
          where: { userId_problemId: { userId: session.user.id, problemId: problem.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  if (!content) notFound()

  const initialStats = {
    totalAccepted,
    totalSubmissions,
    acceptanceRate:
      totalSubmissions > 0
        ? Math.round((totalAccepted / totalSubmissions) * 1000) / 10
        : 0,
  }

  const submissionsDisabled = process.env.JUDGE_SUBMISSIONS_DISABLED === 'true'

  return (
    <ProblemDetail
      problem={{
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        xpReward: problem.xpReward,
        executionRuntime: problem.executionRuntime,
        track: {
          slug: problem.track.slug,
          title: problem.track.title,
          color: problem.track.color,
        },
      }}
      descriptionHtml={content.descriptionHtml}
      starterCode={content.starterCode}
      testCases={content.testCases}
      editorialHtml={content.editorial}
      initialIsSolved={!!progress}
      initialStats={initialStats}
      submissionsDisabled={submissionsDisabled}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { title: true, difficulty: true },
  })
  if (!problem) return {}
  return {
    title: `${problem.title} — leetscuda.com`,
    description:
      'Master CUDA, ML systems, and Kubernetes for AI. The interview prep platform for AI infrastructure engineers.',
  }
}
