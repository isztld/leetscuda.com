import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

export async function GET() {
  const [dbResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    (async () => {
      const redis = getRedis()
      if (!redis) throw new Error('Redis not configured')
      await redis.ping()
    })(),
  ])

  const checks: Record<string, 'ok' | 'error'> = {
    db: dbResult.status === 'fulfilled' ? 'ok' : 'error',
    redis: redisResult.status === 'fulfilled' ? 'ok' : 'error',
  }

  const allHealthy = Object.values(checks).every(v => v === 'ok')

  return Response.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  )
}
