import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { PrismaClient, NodeType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// process.cwd() = apps/web when run via prisma db seed
const LEARNING_DIR = path.join(process.cwd(), '../../learning')

type NodeDef = {
  slug: string
  title: string
  description: string
  type: 'CONCEPT' | 'PROBLEM' | 'ARTICLE' | 'QUIZ'
  cluster?: string
  order: number
  difficulty?: string
  estimatedMinutes?: number
  prerequisites: string[]
  interviewRelevance?: string
}

type TrackDef = {
  slug: string
  title: string
  shortTitle?: string
  description: string
  icon: string
  color: string
  order: number
  difficulty?: string
  estimatedHours?: number
  prerequisites?: string[]
  previewNodes?: number
  nodes: NodeDef[]
}

function loadTracks(): TrackDef[] {
  const entries = fs.readdirSync(LEARNING_DIR, { withFileTypes: true })
  const tracks: TrackDef[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const trackFile = path.join(LEARNING_DIR, entry.name, 'track.mdx')
    if (!fs.existsSync(trackFile)) continue

    const raw = fs.readFileSync(trackFile, 'utf8')
    const { data } = matter(raw)
    tracks.push(data as TrackDef)
  }

  return tracks.sort((a, b) => a.order - b.order)
}

async function main() {
  // Clean up old monolithic 'cuda' track replaced by cuda-core / cuda-hpc / gpu-llm
  const oldCuda = await prisma.track.findUnique({ where: { slug: 'cuda' } })
  if (oldCuda) {
    await prisma.roadmapNode.deleteMany({ where: { trackId: oldCuda.id } })
    console.log('Cleaned up old cuda track nodes')
  }

  const tracks = loadTracks()
  console.log(`Found ${tracks.length} track(s) in learning/`)

  console.log('Seeding tracks...')
  for (const track of tracks) {
    const { nodes: _, ...trackData } = track
    const data = { ...trackData, prerequisites: trackData.prerequisites ?? [] }
    await prisma.track.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    })
  }

  const trackMap = new Map(
    (await prisma.track.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]),
  )

  console.log('Seeding roadmap nodes...')
  for (const track of tracks) {
    const trackId = trackMap.get(track.slug)
    if (!trackId) throw new Error(`Track not found after upsert: ${track.slug}`)

    for (const node of track.nodes) {
      const { type, ...rest } = node
      await prisma.roadmapNode.upsert({
        where: { slug: node.slug },
        update: { ...rest, type: NodeType[type], trackId },
        create: { ...rest, type: NodeType[type], trackId },
      })
    }
  }

  const totalNodes = tracks.reduce((sum, t) => sum + t.nodes.length, 0)
  console.log(
    `✅ Seeded ${tracks.length} tracks, ${totalNodes} roadmap nodes.\n` +
    `   Run pnpm db:sync to populate problems from MDX files.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
