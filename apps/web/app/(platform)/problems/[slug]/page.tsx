import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { loadProblemContent } from '@/lib/problems-content'
import { ProblemDetail } from '@/components/ProblemDetail'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params

  const problem = await prisma.problem.findUnique({
    where: { slug },
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
      editorialHtml={content.editorial}
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
