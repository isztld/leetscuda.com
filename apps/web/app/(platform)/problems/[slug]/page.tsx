import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { loadProblemContent } from '@/lib/problems-content'
import { ProblemDetail } from '@/components/ProblemDetail'

interface Props {
  params: { slug: string }
}

export default async function ProblemPage({ params }: Props) {
  const problem = await prisma.problem.findUnique({
    where: { slug: params.slug },
    include: { track: true },
  })

  if (!problem) notFound()

  let content
  try {
    content = await loadProblemContent(problem.track.slug, problem.slug)
  } catch {
    notFound()
  }

  return (
    <ProblemDetail
      problem={{
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        xpReward: problem.xpReward,
        track: {
          slug: problem.track.slug,
          title: problem.track.title,
          color: problem.track.color,
        },
      }}
      descriptionHtml={content.descriptionHtml}
      starterCode={content.starterCode}
      testCases={content.testCases}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const problem = await prisma.problem.findUnique({
    where: { slug: params.slug },
    select: { title: true, difficulty: true },
  })
  if (!problem) return {}
  return { title: `${problem.title} — leetscuda` }
}
